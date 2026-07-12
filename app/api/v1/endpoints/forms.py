import json
import logging
import uuid
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, Depends, Response
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
    Note: the original file is NOT persisted to storage here — see
    DocumentService.process_upload for why. The browser holds onto the same
    file and re-sends it to /api/{form_id}/generate once the user confirms.
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
    file: UploadFile = File(...),
    mapping_data: str = Form(...),
    db: AsyncSession = Depends(get_db),
    user_id: str | None = Depends(get_current_user_id)
):
    """
    Stamps the extracted/edited field data onto the ORIGINAL document that the
    browser re-sends with this request (it never left the client after the
    initial /api/upload call), uploads ONLY the resulting stamped PDF to
    storage, updates the form record's file_url, and streams the stamped PDF
    back to the browser for download.
    """
    try:
        mapping_list: list[dict] = json.loads(mapping_data)
    except (json.JSONDecodeError, TypeError) as exc:
        raise HTTPException(status_code=400, detail="mapping_data must be a valid JSON array.") from exc

    # Guard against malformed payloads (e.g. a stray {} or an entry missing
    # "field_name") reaching the PDF engine, where they'd fail deep inside
    # PyMuPDF with a much less useful error.
    if not mapping_list:
        raise HTTPException(status_code=400, detail="No field data was provided to fill in.")
    for idx, item in enumerate(mapping_list):
        if not isinstance(item, dict) or "field_name" not in item:
            raise HTTPException(
                status_code=400,
                detail=f"Malformed field entry at index {idx}: expected an object with 'field_name'.",
            )

    try:
        resolved_user_id = document_service._resolve_user_id(user_id)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))

    # 1. Fetch form_type (and confirm the form belongs to this user). filename
    # is no longer needed from the DB — we use the re-uploaded file's own
    # filename below, since that's the file we're actually stamping.
    query = text("""
        SELECT form_type
        FROM forms 
        WHERE id = CAST(:id AS UUID) AND user_id = CAST(:user_id AS UUID)
    """)
    result = await db.execute(query, {"id": form_id, "user_id": resolved_user_id})
    row = result.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Original form not found in database.")

    form_type = row.form_type

    # 2. Read the original document straight from this request — no storage
    # round-trip, because it was never uploaded to storage in the first place.
    original_bytes = await file.read()
    if not original_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # 3. Inject the data into the PDF
    try:
        filled_pdf_bytes, skipped_fields = PDFGeneratorService.fill_pdf(
            original_bytes, mapping_list, form_type, file.filename or "document.pdf"
        )
    except ValueError as e:
        # Clean, user-facing failures — unsupported form_type, corrupt
        # upload, etc. — get a 422 rather than a generic 500.
        logger.warning(f"PDF filling rejected: {str(e)}")
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception(f"PDF filling failed unexpectedly for form_id={form_id}")
        raise HTTPException(status_code=500, detail=f"PDF Generation failed: {str(e)}")

    # 4. Upload ONLY the stamped result to storage. This is the sole write to
    # the bucket in the entire upload -> generate flow, satisfying the "don't
    # store originals" requirement. The user_id-rooted path naturally
    # complies with the existing RLS policy:
    #   (storage.foldername(name))[1] == auth.uid()
    stamped_path = f"{resolved_user_id}/stamped/AXIS_Filled_{form_id}_{uuid.uuid4().hex[:6]}.pdf"
    try:
        document_service.supabase.storage.from_("documents").upload(
            path=stamped_path,
            file=filled_pdf_bytes,
            file_options={"content-type": "application/pdf"},
        )
        stamped_url = document_service.supabase.storage.from_("documents").get_public_url(stamped_path)
    except Exception as e:
        # Don't fail the whole request over a storage hiccup — the user
        # still gets their PDF; we just won't have a persisted copy this time.
        logger.error(f"Failed to persist stamped PDF to storage for form_id={form_id}: {e}")
        stamped_url = None

    # 5. Update the form record with the stamped file's location so
    # ProcessingHistory / downloads-later point at something real.
    if stamped_url:
        update_query = text("""
            UPDATE forms SET file_url = :file_url
            WHERE id = CAST(:id AS UUID) AND user_id = CAST(:user_id AS UUID)
        """)
        await db.execute(update_query, {"file_url": stamped_url, "id": form_id, "user_id": resolved_user_id})
        await db.commit()

    # 6. Return the file directly to the browser. Fields that couldn't be
    # confidently placed on the page (no anchor match, or the target area
    # already had content) are surfaced via a header so the frontend can warn
    # the user rather than them silently getting a PDF that looks complete
    # but isn't.
    headers = {"Content-Disposition": f"attachment; filename=Filled_Form_{form_id}.pdf"}
    if skipped_fields:
        headers["X-Skipped-Fields"] = ",".join(skipped_fields)
        headers["Access-Control-Expose-Headers"] = "X-Skipped-Fields"

    return Response(
        content=filled_pdf_bytes,
        media_type="application/pdf",
        headers=headers,
    )