import logging
import uuid
import json
from typing import Any
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from supabase import create_client, Client
from pydantic import BaseModel, Field, ValidationError

from app.adapters.model_router import ModelRouter
from app.core.config import settings

logger = logging.getLogger(__name__)


# --- ATOMIC EXTRACTION SCHEMAS ---
# These force the AI output into a known shape before it ever reaches the DB
# or the frontend. If the AI returns a blob or malformed field, validation
# raises ValidationError immediately (fail fast) instead of silently storing
# garbage.

class AtomicName(BaseModel):
    first_name: str
    middle_name: str | None = None
    last_name: str
    suffix: str | None = None


class AtomicAddress(BaseModel):
    street: str
    barangay: str
    city: str
    province: str
    zip_code: str


class SSSExtractionSchema(BaseModel):
    name: AtomicName
    address: AtomicAddress
    sss_number: str = Field(..., pattern=r"^\d{3}-\d{7}-\d{1}$")
    mobile_number: str = Field(..., pattern=r"^(09|\+639)\d{9}$")


# Map form_type -> schema. Add new form types here as they're supported.
# form_type values not in this registry fall back to unvalidated passthrough
# (see _validate_extraction below) so this can be extended incrementally.
EXTRACTION_SCHEMA_REGISTRY: dict[str, type[BaseModel]] = {
    "sss": SSSExtractionSchema,
}


def _flatten(value: Any, prefix: str = "") -> dict[str, Any]:
    """Flatten a (possibly nested) pydantic model / dict into dot-path leaves.

    e.g. {"name": {"first_name": "Juan"}} -> {"name.first_name": "Juan"}
    This is what makes the schema "atomic" end-to-end: nested objects don't
    collapse back into a single JSON blob column in extracted_fields.
    """
    flat: dict[str, Any] = {}
    if isinstance(value, BaseModel):
        value = value.model_dump()
    if isinstance(value, dict):
        for key, sub_value in value.items():
            new_prefix = f"{prefix}.{key}" if prefix else str(key)
            flat.update(_flatten(sub_value, new_prefix))
    else:
        flat[prefix] = value
    return flat

class DocumentService:
    """Orchestrates document ingestion, AI extraction, and database storage."""

    def __init__(self, router: ModelRouter | None = None) -> None:
        self.router = router or ModelRouter()
        # Initialize Supabase client for Storage
        self.supabase: Client = create_client(
            settings.supabase_url, 
            settings.supabase_service_role_key # Requires Service Role Key for storage ops
        )

    def _resolve_user_id(self, user_id: str | None) -> str:
        if user_id:
            return user_id
        if settings.environment == "development" and settings.default_dev_user_id:
            logger.warning("AUTH FALLBACK: Using DEFAULT_DEV_USER_ID for unauthenticated request.") # Add this
            return settings.default_dev_user_id
        raise ValueError("user_id required: Authentication token missing.")

    async def process_upload(
        self,
        file: UploadFile,
        form_type: str,
        db: AsyncSession,
        user_id: str | None = None,
    ) -> dict:
        try:
            resolved_user_id = self._resolve_user_id(user_id)
            content = await file.read()
            
            # --- STORAGE PHASE ---
            unique_id = uuid.uuid4().hex[:6]
            if '.' in file.filename:
                filename_base, extension = file.filename.rsplit('.', 1)
                unique_filename = f"{filename_base}_{unique_id}.{extension}"
            else:
                unique_filename = f"{file.filename}_{unique_id}"
                
            storage_path = f"{resolved_user_id}/{unique_filename}"
            
            self.supabase.storage.from_("documents").upload(
                path=storage_path,
                file=content,
                file_options={"content-type": file.content_type}
            )
            file_url = self.supabase.storage.from_("documents").get_public_url(storage_path)

            db_status = "Success"
            ai_results = {}

            # --- AI EXTRACTION PHASE ---
            try:
                extracted_data = await self.router.route_process_document(
                    content, file.content_type
                )
                normalized_data = self._normalize_extraction(extracted_data)
                raw_data = normalized_data.get("data", {})
                # Validate against the atomic schema for this form_type (if
                # one is registered). This is the guardrail: malformed or
                # blob-shaped AI output raises ValidationError here rather
                # than reaching the DB or frontend.
                ai_results = self._validate_extraction(raw_data, form_type)
            except (ValueError, ValidationError) as ai_exc:
                logger.error(
                    "AI/OCR Extraction Pipeline Failed schema validation. Form type: %s. Reason: %s",
                    form_type, str(ai_exc)
                )
                db_status = "Error"
            except Exception as ai_exc:
                logger.error("AI/OCR Extraction Pipeline Failed. Reason: %s", str(ai_exc))
                db_status = "Error"

            # --- DATABASE STORAGE PHASE ---
            new_form_id = uuid.uuid4()
            
            form_query = text("""
                INSERT INTO forms (id, user_id, filename, file_url, form_type, status)
                VALUES (:id, :user_id, :filename, :file_url, :form_type, :status)
            """)

            await db.execute(form_query, {
                "id": new_form_id,
                "user_id": resolved_user_id,
                "filename": file.filename,
                "file_url": file_url,
                "form_type": form_type,
                "status": db_status
            })

            formatted_extracted_data = []

            if db_status == "Success" and ai_results:
                field_query = text("""
                    INSERT INTO extracted_fields (id, form_id, field_name, extracted_value, confidence_score)
                    VALUES (:id, :form_id, :field_name, :extracted_value, :confidence_score)
                """)

                for key, value in ai_results.items():
                    await db.execute(field_query, {
                        "id": uuid.uuid4(),
                        "form_id": new_form_id,
                        "field_name": str(key),
                        "extracted_value": json.dumps(value),
                        "confidence_score": 0.95
                    })

                    formatted_extracted_data.append({
                        "field_name": str(key),
                        "extracted_value": value,
                        "confidence_score": 0.95
                    })

            await db.commit()

            # Construct and return the payload once
            response_payload = {
                "id": str(new_form_id),
                "form_details": {
                    "user_id": resolved_user_id,
                    "filename": file.filename,
                    "file_url": file_url
                },
                "extracted_data": formatted_extracted_data,
                "form_type": form_type,
                "status": "success" if db_status == "Success" else "failed",
            }
            
            logger.info(f"Sending response payload: {json.dumps(response_payload)}")
            return response_payload

        except Exception as exc:
            await db.rollback()
            logger.exception("Document orchestration failed")
            raise

    def _normalize_extraction(self, extracted_data: object) -> dict:
        if not isinstance(extracted_data, dict):
            raise ValueError("AI extraction must return a dictionary payload.")
        return {
            "provider": extracted_data.get("provider"),
            "status": extracted_data.get("status"),
            "data": extracted_data.get("data"),
        }

    def _validate_extraction(self, raw_data: object, form_type: str) -> dict[str, Any]:
        """Enforce the atomic schema for form_type, then flatten to leaves.

        Raises ValueError/ValidationError on malformed input (fail fast) so
        the caller can mark the form as errored instead of persisting a
        blob or partially-shaped record.
        """
        if not isinstance(raw_data, dict):
            raise ValueError(f"AI extraction 'data' must be a dict, got {type(raw_data).__name__}")

        schema = EXTRACTION_SCHEMA_REGISTRY.get(form_type.lower())
        if schema is None:
            logger.warning(
                "No atomic extraction schema registered for form_type=%s; skipping validation.",
                form_type
            )
            return _flatten(raw_data)

        validated = schema.model_validate(raw_data)
        return _flatten(validated)