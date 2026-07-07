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
import httpx # Use httpx instead of requests
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, Depends, Response, Body
from sqlalchemy import text

@router.post("/{form_id}/generate")
async def generate_filled_form(
    form_id: str,
    mapping_data: list[dict] = Body(...),
    db: AsyncSession = Depends(get_db),
    user_id: str | None = Depends(get_current_user_id) # 1. Allow None so we can handle it safely
):
    """Generates a filled PDF and returns it directly to the browser for download."""
    
    # 2. Apply the local development auth fallback logic
    try:
        resolved_user_id = document_service._resolve_user_id(user_id)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    
    # 3. Fetch the original file_url from the DB using the resolved ID
    query = text("SELECT file_url FROM forms WHERE id = CAST(:id AS UUID) AND user_id = CAST(:user_id AS UUID)")
    result = await db.execute(query, {"id": form_id, "user_id": resolved_user_id})
    row = result.scalar_one_or_none()
    
    if not row:
        raise HTTPException(status_code=404, detail="Original form not found in database.")
        
    file_url = row 
    
    # 4. Download the original blank PDF asynchronously using httpx
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(file_url)
            response.raise_for_status() 
            original_bytes = response.content
    except httpx.HTTPStatusError as exc:
        error_msg = f"Supabase blocked the download (HTTP {exc.response.status_code}). Check if bucket is Public."
        logger.error(f"{error_msg} URL: {exc.request.url}")
        raise HTTPException(status_code=500, detail=error_msg)
    except Exception as e:
        logger.error(f"Storage download failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Network Error: {str(e)}")
    
    # 5. Inject the data into the PDF
    try:
        filled_pdf_bytes = PDFGeneratorService.fill_pdf(original_bytes, mapping_data)
    except Exception as e:
        logger.error(f"PDF filling failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"PDF Generation failed: {str(e)}")
    
    # 6. Return the file as a direct download attachment
    return Response(
        content=filled_pdf_bytes, 
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Filled_Form_{form_id}.pdf"}
    )