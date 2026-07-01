import logging

from fastapi import UploadFile

from app.adapters.base import ModelAdapter
from app.adapters.providers import GeminiAdapter

logger = logging.getLogger(__name__)


class DocumentService:
	"""Orchestrates document ingestion and AI extraction for uploaded files."""

	def __init__(self, adapter: ModelAdapter | None = None) -> None:
		self.adapter = adapter or GeminiAdapter()

	async def process_upload(self, file: UploadFile, form_type: str) -> dict:
		"""
		Read an uploaded document, send it to the model adapter, and return a
		stable response payload for the API layer.
		"""
		try:
			content = await file.read()
			file_size = len(content)

			extracted_data = await self.adapter.process_document(content)
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
		status = extracted_data.get("status")
		data = extracted_data.get("data")

		if not provider or not status:
			raise ValueError("AI extraction payload is missing required fields.")

		return {
			"provider": provider,
			"status": status,
			"data": data,
		}
