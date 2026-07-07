import logging
import uuid
import json
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from supabase import create_client, Client

from app.adapters.model_router import ModelRouter
from app.core.config import settings

logger = logging.getLogger(__name__)

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
            return settings.default_dev_user_id
        raise ValueError("user_id required.")

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
            # Path format: <user_id>/<filename> matches your RLS policy (storage.foldername(name))[1]
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
                ai_results = normalized_data.get("data", {})
            except Exception as ai_exc:
                # CHANGE THIS LOG LINE
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

            return {
                "id": str(new_form_id), # <-- ADD THIS LINE
                "form_details": {
                    "user_id": resolved_user_id,
                    "filename": file.filename,
                    "file_url": file_url
                },
                "extracted_data": formatted_extracted_data,
                "form_type": form_type,
                "status": "success" if db_status == "Success" else "failed",
            }

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