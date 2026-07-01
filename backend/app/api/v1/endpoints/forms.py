import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.adapters.providers import GeminiAdapter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["forms"])
adapter = GeminiAdapter()


@router.post("/upload")
async def upload_document(
	file: UploadFile = File(...),
	form_type: str = Form(...),
):
	"""
	Receives a document from the Next.js frontend and processes it using the AI adapter.
	"""
	try:
		content = await file.read()
		file_size = len(content)

		ai_result = await adapter.process_document(content)

		return {
			"filename": file.filename,
			"content_type": file.content_type,
			"size_in_bytes": file_size,
			"form_type": form_type,
			"message": "File processed successfully by AI Engine.",
			"extracted_data": ai_result,
		}
	except Exception as exc:
		logger.exception("Upload processing failed for %s", file.filename)
		raise HTTPException(status_code=500, detail=f"Processing failed: {str(exc)}") from exc


@router.post("/forms/{form_id}/process")
async def process_form(form_id: str):
	"""
	Ashanti's original endpoint to trigger document processing via DB ID.
	"""
	try:
		dummy_data = b"some_file_bytes"
		result = await adapter.process_document(dummy_data)
		return {"status": "success", "result": result}
	except Exception as exc:
		logger.exception("Legacy process failed for form_id=%s", form_id)
		raise HTTPException(status_code=500, detail=str(exc)) from exc
