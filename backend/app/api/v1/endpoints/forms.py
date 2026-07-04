import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, Depends
from sqlalchemy.ext.asyncio import AsyncSession

# --- NEW IMPORTS (The Cloud Engineer's Bridge) ---
from app.db.session import get_db
from app.schema import DocumentExtractionResponse 
# -------------------------------------------------

from app.services.document_service import DocumentService

logger = logging.getLogger(__name__)

# Router definition matching the API v1 structure
router = APIRouter(prefix="/api", tags=["forms"])

# Service instantiation
document_service = DocumentService()


# Notice the new 'response_model' parameter! This is your fail-safe filter.
@router.post("/upload", response_model=DocumentExtractionResponse)
async def upload_document(
    file: UploadFile = File(...),
    form_type: str = Form(...),
    db: AsyncSession = Depends(get_db)  # <--- FIXED: We ask FastAPI for the database here!
):
    """
    Receives a document from the Next.js frontend, processes it using the AI adapter,
    validates it strictly against the database schema, and saves it.
    """
    try:
        # We now pass the 'db' session into the service so it can actually save data!
        return await document_service.process_upload(file, form_type, db)
    except Exception as exc:
        # Log the exception for observability
        logger.exception("Upload processing failed for %s", file.filename)
        # Raise an HTTPException to communicate the failure to the frontend
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(exc)}") from exc