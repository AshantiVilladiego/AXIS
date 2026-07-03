import logging
from fastapi import UploadFile
# Import the ModelRouter instead of specific adapters
from app.services.model_router import ModelRouter 

logger = logging.getLogger(__name__)

class DocumentService:
    """Orchestrates document ingestion and AI extraction via the ModelRouter."""

    def __init__(self) -> None:
        # Initialize the router which handles all provider logic and failover
        self.router = ModelRouter()

    async def process_upload(self, file: UploadFile, form_type: str) -> dict:
        """
        Read an uploaded document, delegate to the ModelRouter, 
        and return the normalized response.
        """
        try:
            content = await file.read()
            if not content:
                raise ValueError("Uploaded file is empty.")

            if not file.content_type:
                raise ValueError("Uploaded file is missing a valid content type.")

            file_size = len(content)

            # Route the request to the ModelRouter instead of a direct adapter call
            # This handles the 'Failover Logic' automatically
            extracted_data = await self.router.route_process_document(content, file.content_type)
            
            normalized_data = self._normalize_extraction(extracted_data)

            return {
                "filename": file.filename,
                "content_type": file.content_type,
                "size_in_bytes": file_size,
                "form_type": form_type,
                "status": "success",
                "message": "File processed successfully by AI Engine.",
                "extracted_data": normalized_data,
            }
        except Exception as exc:
            logger.exception("Document orchestration failed for %s", file.filename)
            raise

    def _normalize_extraction(self, extracted_data: object) -> dict:
        if not isinstance(extracted_data, dict):
            raise ValueError("AI extraction must return a dictionary payload.")
        
        provider = extracted_data.get("provider")
        status = extracted_data.get("status", "success") # Default to success if missing
        data = extracted_data.get("data")

        if not provider or not data:
            raise ValueError("AI extraction payload is missing required fields.")
            
        return {
            "provider": provider,
            "status": status,
            "data": data,
        }