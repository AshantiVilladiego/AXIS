import logging
import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, Depends, Response, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.core.auth import get_current_user_id
from app.db.session import get_db
from app.schema import DocumentExtractionResponse
from app.services.document_service import DocumentService
from app.services.pdf_generator import PDFGeneratorService

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
    
@router.post("/{form_id}/generate")
async def generate_filled_form(
    form_id: str,
    mapping_data: list[dict] = Body(...),
    db: AsyncSession = Depends(get_db),
    user_id: str | None = Depends(get_current_user_id)
):
    """Generates a filled PDF and returns it directly to the browser for download."""

    # Guard against malformed payloads (e.g. a stray {} or an entry missing
    # "field_name") reaching the PDF engine, where they'd fail deep inside
    # PyMuPDF with a much less useful error.
    if not mapping_data:
        raise HTTPException(status_code=400, detail="No field data was provided to fill in.")
    for idx, item in enumerate(mapping_data):
        if not isinstance(item, dict) or "field_name" not in item:
            raise HTTPException(
                status_code=400,
                detail=f"Malformed field entry at index {idx}: expected an object with 'field_name'.",
            )

    try:
        resolved_user_id = document_service._resolve_user_id(user_id)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    
    # 1. Fetch file_url, filename, AND form_type from the DB
    query = text("""
        SELECT file_url, filename, form_type 
        FROM forms 
        WHERE id = CAST(:id AS UUID) AND user_id = CAST(:user_id AS UUID)
    """)
    result = await db.execute(query, {"id": form_id, "user_id": resolved_user_id})
    row = result.fetchone() # Note: Back to fetchone() since we are grabbing 3 columns
    
    if not row:
        raise HTTPException(status_code=404, detail="Original form not found in database.")
        
    file_url = row.file_url 
    filename = row.filename
    form_type = row.form_type
    
    # 2. Download the original document
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
    
    # 3. Inject the data into the PDF (Passing form_type and filename!)
    try:
        filled_pdf_bytes, skipped_fields = PDFGeneratorService.fill_pdf(
            original_bytes, mapping_data, form_type, filename
        )
    except ValueError as e:
        # Clean, user-facing failures — unsupported form_type, corrupt
        # upload, etc. — get a 422 rather than a generic 500.
        logger.warning(f"PDF filling rejected: {str(e)}")
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception(f"PDF filling failed unexpectedly for form_id={form_id}")
        raise HTTPException(status_code=500, detail=f"PDF Generation failed: {str(e)}")

    # 4. Return the file. Fields that couldn't be confidently placed on the
    # page (no anchor match, or the target area already had content) are
    # surfaced via a header so the frontend can warn the user rather than
    # them silently getting a PDF that looks complete but isn't.
    headers = {"Content-Disposition": f"attachment; filename=Filled_Form_{form_id}.pdf"}
    if skipped_fields:
        headers["X-Skipped-Fields"] = ",".join(skipped_fields)
        headers["Access-Control-Expose-Headers"] = "X-Skipped-Fields"

    return Response(
        content=filled_pdf_bytes,
        media_type="application/pdf",
        headers=headers,
    )