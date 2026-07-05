import logging
import uuid
import json
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.adapters.model_router import ModelRouter
from app.core.config import settings

logger = logging.getLogger(__name__)

class DocumentService:
    """Orchestrates document ingestion, AI extraction, and database storage."""

    def __init__(self, router: ModelRouter | None = None) -> None:
        # Uses ModelRouter (Gemini -> Groq -> HuggingFace failover) instead of
        # a single hardcoded adapter, so a Gemini outage/quota exhaustion no
        # longer takes the whole upload pipeline down with it.
        self.router = router or ModelRouter()

    def _resolve_user_id(self, user_id: str | None) -> str:
        """
        Determines which user_id to attribute this upload to.

        - If a real user_id was passed in (e.g. from an authenticated
          session once auth is wired up), use it.
        - Otherwise, only in development, fall back to a placeholder ID
          from settings so local testing keeps working without auth.
        - In any other environment, refuse the upload rather than silently
          attributing it to a fake user.
        """
        if user_id:
            return user_id

        if settings.environment == "development" and settings.default_dev_user_id:
            logger.warning(
                "No user_id supplied; using DEFAULT_DEV_USER_ID fallback "
                "(environment=development only)."
            )
            return settings.default_dev_user_id

        raise ValueError(
            "user_id is required to process an upload. "
            "No authenticated user was found and no development fallback is configured."
        )

    async def process_upload(
        self,
        file: UploadFile,
        form_type: str,
        db: AsyncSession,
        user_id: str | None = None,
    ) -> dict:
        """
        Read an uploaded document, send it to the AI (with automatic
        provider failover), save the results to Supabase, and return a
        stable response payload for the API layer.
        """
        try:
            resolved_user_id = self._resolve_user_id(user_id)

            content = await file.read()
            file_size = len(content)

            # --- AI EXTRACTION PHASE (Gemini -> Groq -> HuggingFace) ---
            extracted_data = await self.router.route_process_document(
                content, file.content_type
            )
            normalized_data = self._normalize_extraction(extracted_data)

            # --- PARSE RESULTS TO DETERMINE STATUS ---
            formatted_extracted_data = []
            ai_results = normalized_data.get("data", {})

            if isinstance(ai_results, str):
                clean_string = ai_results.replace("```json", "").replace("```", "").strip()
                try:
                    ai_results = json.loads(clean_string)
                except json.JSONDecodeError:
                    logger.warning(
                        "AI provider returned plain text instead of JSON for %s: %s",
                        file.filename, ai_results,
                    )
                    ai_results = {"extraction_status": "Failed - Invalid AI Format"}

            # If the AI provider returned text that couldn't be parsed as
            # JSON, ai_results collapses to this single sentinel key/value pair.
            extraction_failed = (
                isinstance(ai_results, dict)
                and set(ai_results.keys()) == {"extraction_status"}
                and ai_results.get("extraction_status") == "Failed - Invalid AI Format"
            )

            db_status = "Error" if extraction_failed else "Success"

            # --- DATABASE STORAGE PHASE ---
            new_form_id = uuid.uuid4()
            file_url_placeholder = f"https://axis-storage.local/{file.filename.replace(' ', '_')}"

            form_query = text("""
                INSERT INTO forms (id, user_id, filename, file_url, form_type, status)
                VALUES (:id, :user_id, :filename, :file_url, :form_type, :status)
            """)

            await db.execute(form_query, {
                "id": new_form_id,
                "user_id": resolved_user_id,
                "filename": file.filename,
                "file_url": file_url_placeholder,
                "form_type": form_type,
                "status": db_status
            })

            field_query = text("""
                INSERT INTO extracted_fields (id, form_id, field_name, extracted_value, confidence_score)
                VALUES (:id, :form_id, :field_name, :extracted_value, :confidence_score)
            """)

            for key, value in ai_results.items():
                db_value = json.dumps(value) if value is not None else None

                await db.execute(field_query, {
                    "id": uuid.uuid4(),
                    "form_id": new_form_id,
                    "field_name": str(key),
                    "extracted_value": db_value,
                    "confidence_score": 0.95
                })

                formatted_extracted_data.append({
                    "field_name": str(key),
                    "extracted_value": value,
                    "confidence_score": 0.95
                })

            await db.commit()

            return {
                "form_details": {
                    "user_id": resolved_user_id,
                    "filename": file.filename,
                    "file_url": file_url_placeholder
                },
                "extracted_data": formatted_extracted_data,
                "form_type": form_type,
                "status": "failed" if extraction_failed else "success",
            }

        except Exception as exc:
            await db.rollback()
            logger.exception("Document orchestration failed for %s", file.filename)
            raise

    def _normalize_extraction(self, extracted_data: object) -> dict:
        if not isinstance(extracted_data, dict):
            raise ValueError("AI extraction must return a dictionary payload.")

        return {
            "provider": extracted_data.get("provider"),
            "status": extracted_data.get("status"),
            "data": extracted_data.get("data"),
        }