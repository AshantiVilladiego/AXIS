import asyncio
import base64
import json
import logging
import re
from io import BytesIO
from typing import Dict, Any, List

from app.adapters.base import ModelAdapter
from app.core.config import settings

from google import genai
from google.genai import types

logger = logging.getLogger(__name__)


class ProviderUnavailableError(RuntimeError):
    """Raised when a provider cannot run due to missing config or unsupported input."""


def _extract_json_payload(text: str) -> Dict[str, Any]:
    """Best-effort parser for model output that may include markdown fences."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        parsed = json.loads(cleaned)
        return parsed if isinstance(parsed, dict) else {"raw": parsed}
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if match:
            try:
                parsed = json.loads(match.group(0))
                return parsed if isinstance(parsed, dict) else {"raw": parsed}
            except json.JSONDecodeError:
                pass

    return {"raw_text": text}


def _render_to_images(file_data: bytes, file_type: str, max_pages: int = 5) -> List[bytes]:
    """
    Converts an uploaded document into a list of PNG image bytes, one per page.

    Gemini's API accepts PDF bytes directly, but Groq and HuggingFace's vision
    chat models only accept images — so PDFs need to be rasterized first.
    If the input is already an image, it's returned as a single-item list
    unchanged. Capped at `max_pages` to keep multi-page government forms from
    blowing up request payload size / token usage.
    """
    if file_type == "application/pdf":
        import fitz  # PyMuPDF

        images: List[bytes] = []
        with fitz.open(stream=file_data, filetype="pdf") as doc:
            for page_index in range(min(len(doc), max_pages)):
                page = doc[page_index]
                # 2x zoom for better OCR legibility on small form text
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                images.append(pix.tobytes("png"))
        if not images:
            raise ProviderUnavailableError("PDF contained no renderable pages.")
        return images

    if file_type and file_type.startswith("image/"):
        return [file_data]

    raise ProviderUnavailableError(f"Unsupported file type for OCR: {file_type}")


EXTRACTION_PROMPT = (
    "Extract all fields from this document image. "
    "Return a single valid JSON object only, with no markdown fences or commentary. "
    "If a field is missing or illegible, set it to null."
)


class GeminiAdapter(ModelAdapter):
    def __init__(self):
        self.api_key = settings.gemini_api_key
        self.client = genai.Client(api_key=self.api_key) if self.api_key else None

    def _ensure_ready(self) -> None:
        if not self.client:
            raise ProviderUnavailableError("GEMINI_API_KEY is not configured.")

    async def process_document(self, file_data: bytes, file_type: str) -> Dict[str, Any]:
        self._ensure_ready()

        # gemini-1.5-flash has been removed from the API (confirmed 404 as of
        # July 2026) — dropped from the candidate list. gemini-2.5-flash-lite
        # added as a cheaper/higher-quota fallback behind the two main models.
        model_candidates = [
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-2.5-flash-lite",
        ]
        last_error: Exception | None = None

        for model_name in model_candidates:
            try:
                response = await asyncio.to_thread(
                    self.client.models.generate_content,
                    model=model_name,
                    contents=[
                        EXTRACTION_PROMPT,
                        types.Part.from_bytes(data=file_data, mime_type=file_type),
                    ],
                    config=types.GenerateContentConfig(temperature=0),
                )

                text = response.text or "{}"
                parsed_payload = _extract_json_payload(text)
                return {
                    "provider": "gemini",
                    "status": "success",
                    "data": parsed_payload,
                    "model": model_name,
                }
            except Exception as e:
                last_error = e
                error_str = str(e)
                logger.warning("Gemini model attempt failed for %s: %s", model_name, error_str)
                # A 429 (quota exhausted) or 404 (model gone) won't be fixed by
                # retrying the same class of model at a different tier within
                # this account, but we still try the next candidate in case
                # only one specific model is rate-limited/deprecated.
                continue

        # All Gemini models failed. Treat quota/billing exhaustion as
        # "unavailable" (so ModelRouter moves on to Groq/HF) rather than a
        # hard crash — this is the whole point of having a router.
        raise ProviderUnavailableError(f"All Gemini models failed: {str(last_error)}")

    async def validate_data(self, extracted_data: Dict[str, Any]) -> Dict[str, Any]:
        return extracted_data

    def get_provider_name(self) -> str:
        return "Gemini"


class GroqAdapter(ModelAdapter):
    def __init__(self):
        self.client = None
        self.api_key = settings.groq_api_key

        if self.api_key:
            from groq import Groq

            self.client = Groq(api_key=self.api_key)

    def _ensure_ready(self) -> None:
        if not self.client:
            raise ProviderUnavailableError("GROQ_API_KEY is not configured.")

    async def process_document(self, file_data: bytes, file_type: str) -> Dict[str, Any]:
        self._ensure_ready()

        # Groq's vision models take images, not raw PDF bytes — rasterize first.
        try:
            page_images = _render_to_images(file_data, file_type)
        except ProviderUnavailableError:
            raise
        except Exception as e:
            raise ProviderUnavailableError(f"Could not render document to image(s): {e}")

        # Model names current as of this writing; Groq's vision lineup changes
        # fairly often, so multiple candidates are tried in order.
        model_candidates = [
            "llama-3.2-90b-vision-preview",
            "llama-3.2-11b-vision-preview",
        ]

        image_content = [
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/png;base64,{base64.b64encode(img).decode('utf-8')}"
                },
            }
            for img in page_images
        ]

        messages = [
            {
                "role": "user",
                "content": [{"type": "text", "text": EXTRACTION_PROMPT}] + image_content,
            }
        ]

        last_error: Exception | None = None
        for model_name in model_candidates:
            try:
                response = await asyncio.to_thread(
                    self.client.chat.completions.create,
                    model=model_name,
                    messages=messages,
                    temperature=0,
                )
                text = response.choices[0].message.content or "{}"
                parsed_payload = _extract_json_payload(text)
                return {
                    "provider": "groq",
                    "status": "success",
                    "data": parsed_payload,
                    "model": model_name,
                }
            except Exception as e:
                last_error = e
                logger.warning("Groq model attempt failed for %s: %s", model_name, str(e))
                continue

        raise ProviderUnavailableError(f"All Groq models failed: {str(last_error)}")

    async def validate_data(self, extracted_data: Dict[str, Any]) -> Dict[str, Any]:
        return extracted_data

    def get_provider_name(self) -> str:
        return "Groq"


class HFAdapter(ModelAdapter):
    def __init__(self):
        self.client = None
        self.api_key = settings.hf_api_key

        if self.api_key:
            from huggingface_hub import InferenceClient

            self.client = InferenceClient(token=self.api_key)

    def _ensure_ready(self) -> None:
        if not self.client:
            raise ProviderUnavailableError("HF_API_KEY is not configured.")

    async def process_document(self, file_data: bytes, file_type: str) -> Dict[str, Any]:
        self._ensure_ready()

        try:
            page_images = _render_to_images(file_data, file_type)
        except ProviderUnavailableError:
            raise
        except Exception as e:
            raise ProviderUnavailableError(f"Could not render document to image(s): {e}")

        # Only the first page is sent to HF — most Inference API vision
        # models/providers don't yet support multi-image chat turns reliably.
        # Good enough as a last-resort fallback; not a full replacement for
        # Gemini's multi-page handling.
        first_page_b64 = base64.b64encode(page_images[0]).decode("utf-8")

        model_candidates = [
            "meta-llama/Llama-3.2-11B-Vision-Instruct",
        ]

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": EXTRACTION_PROMPT},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{first_page_b64}"},
                    },
                ],
            }
        ]

        last_error: Exception | None = None
        for model_name in model_candidates:
            try:
                response = await asyncio.to_thread(
                    self.client.chat_completion,
                    messages=messages,
                    model=model_name,
                    temperature=0,
                )
                text = response.choices[0].message.content or "{}"
                parsed_payload = _extract_json_payload(text)
                return {
                    "provider": "huggingface",
                    "status": "success",
                    "data": parsed_payload,
                    "model": model_name,
                }
            except Exception as e:
                last_error = e
                logger.warning("HuggingFace model attempt failed for %s: %s", model_name, str(e))
                continue

        raise ProviderUnavailableError(f"All HuggingFace models failed: {str(last_error)}")

    async def validate_data(self, extracted_data: Dict[str, Any]) -> Dict[str, Any]:
        return extracted_data

    def get_provider_name(self) -> str:
        return "HuggingFace"