import asyncio
import base64
import json
import logging
import os
import certifi # <--- ADD THIS
from typing import Dict, Any, List

# This forces all SSL requests to use the certifi bundle, which works everywhere
os.environ["SSL_CERT_FILE"] = certifi.where()

from app.adapters.base import ModelAdapter
from app.core.config import settings

from google import genai
from google.genai import types

# --- NEW HELPER FUNCTION ---
async def get_ai_client():
    """Helper for manual HTTP calls that need SSL verification."""
    return httpx.AsyncClient(
        verify=certifi.where(), 
        timeout=30.0
    )

logger = logging.getLogger(__name__)

class ProviderUnavailableError(RuntimeError):
    """Raised when a provider cannot run due to missing config or unsupported input."""

def _parse_json_safely(text: str) -> Dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        if lines[0].startswith("```"): lines = lines[1:]
        if lines and lines[-1].startswith("```"): lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    try:
        parsed = json.loads(cleaned)
        if not isinstance(parsed, dict):
            raise ValueError("Output is valid JSON but not a dictionary object.")
        return parsed
    except json.JSONDecodeError as e:
        raise ValueError(f"Model returned invalid JSON: {e}")

def _render_to_images(file_data: bytes, file_type: str, max_pages: int = 5) -> List[bytes]:
    if file_type == "application/pdf":
        import fitz  # PyMuPDF
        images: List[bytes] = []
        with fitz.open(stream=file_data, filetype="pdf") as doc:
            for page_index in range(min(len(doc), max_pages)):
                page = doc[page_index]
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                images.append(pix.tobytes("png"))
        if not images:
            raise ProviderUnavailableError("PDF contained no renderable pages.")
        return images
    if file_type and file_type.startswith("image/"):
        return [file_data]
    raise ProviderUnavailableError(f"Unsupported file type for OCR: {file_type}")

# --- THE FIX: Smart Grouping & Signature Omission ---
EXTRACTION_PROMPT = (
    "Extract all fields from this document image into a single valid JSON object. "
    "CRITICAL INSTRUCTIONS:\n"
    "1. Do NOT extract physical signatures, thumbprints, or purely instructional text.\n"
    "2. Group names logically into objects (e.g., 'registrant_name', 'father_name', 'mother_name', 'spouse_name').\n"
    "3. Group repeating lists into arrays (e.g., 'children': [ {'last_name': '...', 'first_name': '...'} ]).\n"
    "4. If a field is blank, set its value to null.\n"
    "Do not include markdown formatting or code blocks."
)

class GeminiAdapter(ModelAdapter):
    def __init__(self):
        self.api_key = settings.gemini_api_key
        self.client = genai.Client(api_key=self.api_key) if self.api_key else None

    def _ensure_ready(self) -> None:
        if not self.client: raise ProviderUnavailableError("GEMINI_API_KEY is not configured.")

    async def process_document(self, file_data: bytes, file_type: str) -> Dict[str, Any]:
        self._ensure_ready()
        model_candidates = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite"]
        last_error = None

        for model_name in model_candidates:
            try:
                response = await asyncio.to_thread(
                    self.client.models.generate_content,
                    model=model_name,
                    contents=[EXTRACTION_PROMPT, types.Part.from_bytes(data=file_data, mime_type=file_type)],
                    config=types.GenerateContentConfig(temperature=0, response_mime_type="application/json"),
                )
                return {"provider": "gemini", "status": "success", "data": _parse_json_safely(response.text or "{}"), "model": model_name}
            except Exception as e:
                last_error = e; logger.warning("Gemini attempt failed for %s: %s", model_name, str(e))
                continue
        raise ProviderUnavailableError(f"All Gemini models failed: {str(last_error)}")

    async def validate_data(self, extracted_data: Dict[str, Any]) -> Dict[str, Any]: return extracted_data
    def get_provider_name(self) -> str: return "Gemini"

class GroqAdapter(ModelAdapter):
    def __init__(self):
        self.api_key = settings.groq_api_key
        if self.api_key:
            from groq import Groq
            self.client = Groq(api_key=self.api_key)

    def _ensure_ready(self) -> None:
        if not getattr(self, 'client', None): raise ProviderUnavailableError("GROQ_API_KEY is not configured.")

    async def process_document(self, file_data: bytes, file_type: str) -> Dict[str, Any]:
        self._ensure_ready()
        page_images = _render_to_images(file_data, file_type)
        model_candidates = ["llama-3.2-90b-vision-instruct", "llama-3.2-11b-vision-instruct"]
        image_content = [{"type": "image_url", "image_url": {"url": f"data:image/png;base64,{base64.b64encode(img).decode('utf-8')}"}} for img in page_images]
        messages = [{"role": "user", "content": [{"type": "text", "text": EXTRACTION_PROMPT}] + image_content}]

        last_error = None
        for model_name in model_candidates:
            try:
                response = await asyncio.to_thread(
                    self.client.chat.completions.create,
                    model=model_name, messages=messages, temperature=0, response_format={"type": "json_object"},
                )
                return {"provider": "groq", "status": "success", "data": _parse_json_safely(response.choices[0].message.content or "{}"), "model": model_name}
            except Exception as e:
                last_error = e; logger.warning("Groq attempt failed for %s: %s", model_name, str(e))
                continue
        raise ProviderUnavailableError(f"All Groq models failed: {str(last_error)}")

    async def validate_data(self, extracted_data: Dict[str, Any]) -> Dict[str, Any]: return extracted_data
    def get_provider_name(self) -> str: return "Groq"

class HFAdapter(ModelAdapter):
    def __init__(self):
        self.api_key = settings.hf_api_key
        if self.api_key:
            from huggingface_hub import InferenceClient
            self.client = InferenceClient(token=self.api_key)

    def _ensure_ready(self) -> None:
        if not getattr(self, 'client', None): raise ProviderUnavailableError("HF_API_KEY is not configured.")

    async def process_document(self, file_data: bytes, file_type: str) -> Dict[str, Any]:
        self._ensure_ready()
        page_images = _render_to_images(file_data, file_type)
        first_page_b64 = base64.b64encode(page_images[0]).decode("utf-8")
        messages = [{"role": "user", "content": [{"type": "text", "text": EXTRACTION_PROMPT}, {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{first_page_b64}"}}]}]

        try:
            response = await asyncio.to_thread(self.client.chat_completion, messages=messages, model="meta-llama/Llama-3.2-11B-Vision-Instruct", temperature=0)
            return {"provider": "huggingface", "status": "success", "data": _parse_json_safely(response.choices[0].message.content or "{}"), "model": "meta-llama/Llama-3.2-11B-Vision-Instruct"}
        except Exception as e:
            raise ProviderUnavailableError(f"HuggingFace failed: {str(e)}")

    async def validate_data(self, extracted_data: Dict[str, Any]) -> Dict[str, Any]: return extracted_data
    def get_provider_name(self) -> str: return "HuggingFace"