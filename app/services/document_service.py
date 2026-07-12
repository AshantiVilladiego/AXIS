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

# --- FORM AWARE REGISTRY ---
# Aggressive suppression of Administrative Fields, Checkboxes, and physical actions.
class FormRegistry:
    MANUAL_FIELDS = {
        "signature", "thumb", "registrant_date", "using_additional_sheet", 
        "agree_with_spouse", "business_code", "monthly_earnings", "approved_msc",
        "yes", "no", "approved", "disapproved", "others", "flexi_fund", "received_by", 
        "date_time", "msc", "working_spouse", "contribution", "payment", "printed_name",
        "date"
    }

    @classmethod
    def is_chat_allowed(cls, field_name: str) -> bool:
        # Strictly ignore standalone dates or printed names that are clearly meant for signing blocks
        normalized = field_name.lower().replace("_", "")
        if normalized == "date" or normalized == "printedname":
            return False
            
        for manual_key in cls.MANUAL_FIELDS:
            if manual_key.replace("_", "") in normalized:
                return False
        return True

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

EXTRACTION_SCHEMA_REGISTRY: dict[str, type[BaseModel]] = {
    "sss": SSSExtractionSchema,
}

def _flatten(value: Any, prefix: str = "") -> dict[str, Any]:
    flat: dict[str, Any] = {}
    if isinstance(value, BaseModel): value = value.model_dump()
    if isinstance(value, dict):
        for key, sub_value in value.items():
            new_prefix = f"{prefix}.{key}" if prefix else str(key)
            flat.update(_flatten(sub_value, new_prefix))
    else: flat[prefix] = value
    return flat

class DocumentService:
    def __init__(self, router: ModelRouter | None = None) -> None:
        self.router = router or ModelRouter()
        self.supabase: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)

    def _resolve_user_id(self, user_id: str | None) -> str:
        if user_id: return user_id
        if settings.environment == "development" and settings.default_dev_user_id: return settings.default_dev_user_id
        raise ValueError("user_id required: Authentication token missing.")

    async def process_upload(self, file: UploadFile, form_type: str, db: AsyncSession, user_id: str | None = None) -> dict:
        try:
            resolved_user_id = self._resolve_user_id(user_id)
            content = await file.read()

            # NOTE: The original file is intentionally NOT uploaded to Supabase
            # Storage here. It only ever lives in memory for this request, long
            # enough to run AI extraction. The browser hangs onto the same File
            # object (UploadForm.tsx keeps `selectedFile` in React state through
            # the review/edit flow) and re-sends it later to /api/{form_id}/generate,
            # which is the only step that writes anything to storage — the
            # final, stamped PDF. This keeps raw source documents out of the
            # bucket entirely; only finalized output is persisted.
            file_url = None

            db_status = "Success"
            ai_results = {}
            self_field_groups: list[str] = []

            try:
                extracted_data = await self.router.route_process_document(content, file.content_type)
                normalized_data = self._normalize_extraction(extracted_data)
                raw_data = normalized_data.get("data", {})
                # Pulled out before validation/flattening so it's never treated
                # as a real form field — this is metadata about the OTHER
                # fields (which top-level groups are the registrant's own info
                # vs. a relative's/beneficiary's), used by the frontend to
                # stop profile auto-fill from bleeding onto e.g. father_name.
                if isinstance(raw_data, dict):
                    self_field_groups = raw_data.pop("_self_field_groups", []) or []
                ai_results = self._validate_extraction(raw_data, form_type)
            except Exception as ai_exc:
                logger.error("AI/OCR Extraction Pipeline Failed. Reason: %s", str(ai_exc))
                db_status = "Error"

            new_form_id = uuid.uuid4()
            # file_url is deliberately NULL at this point — it's populated
            # later by /api/{form_id}/generate once the stamped PDF exists.
            # This requires the `forms.file_url` column to be nullable; if it
            # currently has a NOT NULL constraint, drop that constraint first.
            form_query = text("INSERT INTO forms (id, user_id, filename, file_url, form_type, status) VALUES (:id, :user_id, :filename, :file_url, :form_type, :status)")
            await db.execute(form_query, {"id": new_form_id, "user_id": resolved_user_id, "filename": file.filename, "file_url": file_url, "form_type": form_type, "status": db_status})

            formatted_extracted_data = []

            if db_status == "Success" and ai_results:
                field_query = text("INSERT INTO extracted_fields (id, form_id, field_name, extracted_value, confidence_score) VALUES (:id, :form_id, :field_name, :extracted_value, :confidence_score)")

                for key, value in ai_results.items():
                    if not FormRegistry.is_chat_allowed(str(key)): continue

                    await db.execute(field_query, {"id": uuid.uuid4(), "form_id": new_form_id, "field_name": str(key), "extracted_value": json.dumps(value), "confidence_score": 0.95})
                    formatted_extracted_data.append({"field_name": str(key), "extracted_value": value, "confidence_score": 0.95})

            await db.commit()
            return {
                "id": str(new_form_id),
                "form_details": {"user_id": resolved_user_id, "filename": file.filename, "file_url": file_url},
                "extracted_data": formatted_extracted_data,
                "self_field_groups": self_field_groups,
                "form_type": form_type,
                "status": "success" if db_status == "Success" else "failed",
            }

        except Exception as exc:
            await db.rollback()
            logger.exception("Document orchestration failed")
            raise

    def _normalize_extraction(self, extracted_data: object) -> dict:
        if not isinstance(extracted_data, dict): raise ValueError("AI extraction must return a dictionary payload.")
        return {"provider": extracted_data.get("provider"), "status": extracted_data.get("status"), "data": extracted_data.get("data")}

    def _validate_extraction(self, raw_data: object, form_type: str) -> dict[str, Any]:
        if not isinstance(raw_data, dict): raise ValueError(f"AI extraction 'data' must be a dict, got {type(raw_data).__name__}")
        schema = EXTRACTION_SCHEMA_REGISTRY.get(form_type.lower())
        if schema is None: return _flatten(raw_data)
        validated = schema.model_validate(raw_data)
        return _flatten(validated)