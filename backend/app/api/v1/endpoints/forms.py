import logging
import requests
from fastapi import Response, Body
from app.services.pdf_generator import PDFGeneratorService

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.db.session import get_db
from app.schema import DocumentExtractionResponse

from app.services.document_service import DocumentService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["forms"])

document_service = DocumentService()


@router.post("/upload", response_model=DocumentExtractionResponse)
async def upload_document(
    file: UploadFile = File(...),
    form_type: str = Form(...),
    db: AsyncSession = Depends(get_db),
    # Derived from a verified Supabase access token — never trust a
    # client-supplied user_id field, since any caller could set it to
    # someone else's id. See app/core/auth.py for the verification logic.
    user_id: str | None = Depends(get_current_user_id),
):
    """
    Receives a document from the Next.js frontend, processes it using the AI adapter,
    validates it strictly against the database schema, and saves it.
    """
    try:
        return await document_service.process_upload(file, form_type, db, user_id=user_id)
    except ValueError as exc:
        # Raised by DocumentService when no user_id is available and we're
        # not in development — a 400 (bad request), not a 500 (server bug).
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Upload processing failed for %s", file.filename)
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(exc)}") from exc
    
import requests
from fastapi import Response, Body
from app.services.pdf_generator import PDFGeneratorService

@router.post("/{form_id}/generate")
async def generate_filled_form(
    form_id: str,
    mapping_data: list[dict] = Body(...), # The coordinates and text from the frontend
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Generates a filled PDF and returns it directly to the browser for download."""
    
    # 1. Fetch the original file_url from the DB using the form_id
    query = text("SELECT file_url FROM forms WHERE id = :id AND user_id = :user_id")
    result = await db.execute(query, {"id": form_id, "user_id": user_id})
    row = result.fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Original form not found in database.")
        
    file_url = row[0]
    
    # 2. Download the original blank PDF from your Supabase storage
    try:
        response = requests.get(file_url)
        response.raise_for_status()
        original_bytes = response.content
    except Exception as e:
        raise HTTPException(status_code=500, detail="Could not retrieve the original PDF from storage.")
    
    # 3. Inject the data into the PDF
    try:
        filled_pdf_bytes = PDFGeneratorService.fill_pdf(original_bytes, mapping_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF Generation failed: {str(e)}")
    
    # 4. Return the file as a direct download attachment
    return Response(
        content=filled_pdf_bytes, 
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Filled_Form_{form_id}.pdf"}
    )