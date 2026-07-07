from __future__ import annotations
import os
from abc import ABC, abstractmethod
import httpx


class ChatAdapterError(Exception):
    """Raised when a provider fails to return a usable completion."""

    def __init__(self, provider: str, message: str, status_code: int | None = None):
        self.provider = provider
        self.status_code = status_code
        super().__init__(f"[{provider}] {message}")


class ChatAdapter(ABC):
    provider_name: str

    @abstractmethod
    async def complete(self, messages: list[dict], *, temperature: float = 0.4) -> str:
        """Return the assistant's reply text, or raise ChatAdapterError."""
        raise NotImplementedError


class GeminiChatAdapter(ChatAdapter):
    provider_name = "gemini"

    # Overridable via env so the team can bump models without a code change.
    DEFAULT_MODEL = "gemini-2.5-flash"
    ENDPOINT_TEMPLATE = (
        "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    )

    def __init__(self) -> None:
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.model = os.getenv("GEMINI_MODEL", self.DEFAULT_MODEL)

    async def complete(self, messages: list[dict], *, temperature: float = 0.4) -> str:
        if not self.api_key:
            raise ChatAdapterError(self.provider_name, "GEMINI_API_KEY is not set.")

        # Gemini splits out the system instruction and uses "model" instead
        # of "assistant" as the role name.
        system_parts = [m["content"] for m in messages if m["role"] == "system"]
        contents = [
            {
                "role": "model" if m["role"] == "assistant" else "user",
                "parts": [{"text": m["content"]}],
            }
            for m in messages
            if m["role"] != "system"
        ]

        payload: dict = {
            "contents": contents,
            "generationConfig": {"temperature": temperature},
        }
        if system_parts:
            payload["systemInstruction"] = {"parts": [{"text": "\n\n".join(system_parts)}]}

        url = self.ENDPOINT_TEMPLATE.format(model=self.model)

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    url,
                    headers={
                        "x-goog-api-key": self.api_key,
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
            except httpx.HTTPError as exc:
                raise ChatAdapterError(self.provider_name, f"Request failed: {exc}") from exc

        if response.status_code != 200:
            raise ChatAdapterError(
                self.provider_name, response.text, status_code=response.status_code
            )

        data = response.json()
        try:
            candidates = data["candidates"][0]["content"]["parts"]
            return "".join(part.get("text", "") for part in candidates).strip()
        except (KeyError, IndexError) as exc:
            raise ChatAdapterError(
                self.provider_name, f"Unexpected response shape: {data}"
            ) from exc


class GroqChatAdapter(ChatAdapter):
    provider_name = "groq"

    DEFAULT_MODEL = "llama-3.3-70b-versatile"
    ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"

    def __init__(self) -> None:
        self.api_key = os.getenv("GROQ_API_KEY")
        self.model = os.getenv("GROQ_MODEL", self.DEFAULT_MODEL)

    async def complete(self, messages: list[dict], *, temperature: float = 0.4) -> str:
        if not self.api_key:
            raise ChatAdapterError(self.provider_name, "GROQ_API_KEY is not set.")

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    self.ENDPOINT,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "messages": messages,
                        "temperature": temperature,
                    },
                )
            except httpx.HTTPError as exc:
                raise ChatAdapterError(self.provider_name, f"Request failed: {exc}") from exc

        if response.status_code != 200:
            raise ChatAdapterError(
                self.provider_name, response.text, status_code=response.status_code
            )

        data = response.json()
        try:
            return data["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError) as exc:
            raise ChatAdapterError(
                self.provider_name, f"Unexpected response shape: {data}"
            ) from exc


class HuggingFaceChatAdapter(ChatAdapter):
    provider_name = "huggingface"

    # ":auto" lets HF's router pick a supported inference provider for
    # the model. Override with HF_CHAT_MODEL once the team settles on a
    # specific model + provider combo (e.g. "meta-llama/Llama-3.3-70B-Instruct:cerebras").
    DEFAULT_MODEL = "meta-llama/Llama-3.3-70B-Instruct:auto"
    ENDPOINT = "https://router.huggingface.co/v1/chat/completions"

    def __init__(self) -> None:
        self.api_key = os.getenv("HF_API_KEY")
        self.model = os.getenv("HF_CHAT_MODEL", self.DEFAULT_MODEL)

    async def complete(self, messages: list[dict], *, temperature: float = 0.4) -> str:
        if not self.api_key:
            raise ChatAdapterError(self.provider_name, "HF_API_KEY is not set.")

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    self.ENDPOINT,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "messages": messages,
                        "temperature": temperature,
                    },
                )
            except httpx.HTTPError as exc:
                raise ChatAdapterError(self.provider_name, f"Request failed: {exc}") from exc

        if response.status_code != 200:
            raise ChatAdapterError(
                self.provider_name, response.text, status_code=response.status_code
            )

        data = response.json()
        try:
            return data["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError) as exc:
            raise ChatAdapterError(
                self.provider_name, f"Unexpected response shape: {data}"
            ) from exc


ADAPTERS: dict[str, type[ChatAdapter]] = {
    "gemini": GeminiChatAdapter,
    "groq": GroqChatAdapter,
    "huggingface": HuggingFaceChatAdapter,
}

# Mirrors System_Architecture_Specification.md §5 (AI Provider Routing):
# primary Gemini, fallback Groq, secondary fallback HuggingFace.
FALLBACK_ORDER: list[str] = ["gemini", "groq", "huggingface"]
