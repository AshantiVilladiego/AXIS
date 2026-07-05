import asyncio
import base64
import json
import logging
from typing import Dict, Any, List

from app.adapters.base import ModelAdapter
from app.core.config import settings

from google import genai
from google.genai import types

logger = logging.getLogger(__name__)


class ProviderUnavailableError(RuntimeError):
    """Raised when a provider cannot run due to missing config or unsupported input."""


def _parse_json_safely(text: str) -> Dict[str, Any]:
    """
    Enforces that the output is parseable JSON. 
    If a model ignores native JSON mode and wraps output in markdown, it strips it.
    If it completely hallucinates, it raises a ValueError to trigger the failover router.
    """
    cleaned = text.strip()
    if cleaned.startswith("```"):
        # Strip the opening ```json and closing ```
        lines = cleaned.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    try:
        parsed = json.loads(cleaned)
        if not isinstance(parsed, dict):
            raise ValueError("Output is valid JSON but not a dictionary object.")
        return parsed
    except json.JSONDecodeError as e:
        raise ValueError(f"Model returned invalid JSON: {e}")


def _render_to_images(file_data: bytes, file_type: str, max_pages: int = 5) -> List[bytes]:
    """
    Converts an uploaded document into a list of PNG image bytes, one per page.
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
    "Return a single valid JSON object only. Do not include markdown formatting, "
    "conversational text, or code blocks. If a field is missing or illegible, set it to null."
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
                    # Force Native Structured Output
                    config=types.GenerateContentConfig(
                        temperature=0,
                        response_mime_type="application/json"
                    ),
                )

                text = response.text or "{}"
                parsed_payload = _parse_json_safely(text)
                
                return {
                    "provider": "gemini",
                    "status": "success",
                    "data": parsed_payload,
                    "model": model_name,
                }
            except Exception as e:
                last_error = e
                logger.warning("Gemini attempt failed for %s: %s", model_name, str(e))
                continue

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

        try:
            page_images = _render_to_images(file_data, file_type)
        except ProviderUnavailableError:
            raise
        except Exception as e:
            raise ProviderUnavailableError(f"Could not render document to image(s): {e}")

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
                    # Force Native Structured Output
                    response_format={"type": "json_object"},
                )
                text = response.choices[0].message.content or "{}"
                parsed_payload = _parse_json_safely(text)
                
                return {
                    "provider": "groq",
                    "status": "success",
                    "data": parsed_payload,
                    "model": model_name,
                }
            except Exception as e:
                last_error = e
                logger.warning("Groq attempt failed for %s: %s", model_name, str(e))
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

        first_page_b64 = base64.b64encode(page_images[0]).decode("utf-8")
        model_candidates = ["meta-llama/Llama-3.2-11B-Vision-Instruct"]

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
                parsed_payload = _parse_json_safely(text)
                
                return {
                    "provider": "huggingface",
                    "status": "success",
                    "data": parsed_payload,
                    "model": model_name,
                }
            except Exception as e:
                last_error = e
                logger.warning("HuggingFace attempt failed for %s: %s", model_name, str(e))
                continue

        raise ProviderUnavailableError(f"All HuggingFace models failed: {str(last_error)}")

    async def validate_data(self, extracted_data: Dict[str, Any]) -> Dict[str, Any]:
        return extracted_data

    def get_provider_name(self) -> str:
        return "HuggingFace"