import asyncio
import json
import logging
import re
from typing import Dict, Any

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
        cleaned = re.sub(r"^```(?:json)?\\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\\s*```$", "", cleaned)

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

class GeminiAdapter(ModelAdapter):
    def __init__(self):
        self.api_key = settings.gemini_api_key
        self.client = genai.Client(api_key=self.api_key) if self.api_key else None

    def _ensure_ready(self) -> None:
        if not self.client:
            raise ProviderUnavailableError("GEMINI_API_KEY is not configured.")

    async def process_document(self, file_data: bytes, file_type: str) -> Dict[str, Any]:
        self._ensure_ready()
        prompt = (
            "Extract fields from this uploaded document. "
            "Return a single valid JSON object only. "
            "If a field is missing, set it to null."
        )

        model_candidates = [
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-1.5-flash-latest",
        ]
        last_error: Exception | None = None

        for model_name in model_candidates:
            try:
                response = await asyncio.to_thread(
                    self.client.models.generate_content,
                    model=model_name,
                    contents=[
                        prompt,
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
                logger.warning("Gemini model attempt failed for %s: %s", model_name, str(e))
                continue

        raise Exception(f"Gemini API Error: {str(last_error)}")

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
            raise ProviderUnavailableError(
                "Groq adapter does not support direct PDF/image OCR in this route."
            )
        except ProviderUnavailableError:
            raise
        except Exception as e:
            raise Exception(f"Groq API Error: {str(e)}")

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
            raise ProviderUnavailableError(
                "HuggingFace adapter does not support direct PDF/image OCR in this route."
            )
        except ProviderUnavailableError:
            raise
        except Exception as e:
            raise Exception(f"HuggingFace API Error: {str(e)}")

    async def validate_data(self, extracted_data: Dict[str, Any]) -> Dict[str, Any]:
        return extracted_data

    def get_provider_name(self) -> str:
        return "HuggingFace"