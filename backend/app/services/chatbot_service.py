"""
ChatbotService — orchestration layer for the Form Assistant chatbot.

Mirrors the role `document_service.py` plays for the upload pipeline:
this is the one place that knows how to turn a chat request into a
prompt, pick a provider, apply the fallback chain from
System_Architecture_Specification.md §5, and shape the result for the
API layer. The FastAPI route in
`api/v1/endpoints/chatbot.py` should stay thin and just call this.
"""

from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass, field

from app.adapters.chat_adapters import (
    ADAPTERS,
    FALLBACK_ORDER,
    ChatAdapterError,
)

from app.services.fixed_prompts import get_fixed_answer

async def handle_chat_message(payload: ChatRequest) -> ChatResponse:
    if payload.fixed_prompt_key:
        answer = get_fixed_answer(
            payload.fixed_prompt_key,
            document_key=payload.document_key,
        )
        return ChatResponse(reply=answer, steps=None)

    # only reaches here for free-text chat — this is where providers.py comes in
    adapter = get_adapter(payload.model)

logger = logging.getLogger(__name__)

# Spec says 3 max retries / 5s delay for the document-processing queue.
# A chat reply is interactive, so we keep one short retry per provider
# (covers a transient 429/500) before moving to the next provider in
# the fallback chain, rather than blocking the user for 15+ seconds.
RETRY_DELAY_SECONDS = 5
MAX_RETRIES_PER_PROVIDER = 1

SYSTEM_PROMPT_TEMPLATE = {
    "en": (
        "You are the AXIS Form Assistant, embedded in a government-form "
        "completion tool. Help the user fill out their form correctly and "
        "confidently. Be concise, plain-spoken, and encouraging. When your "
        "answer is a sequence of actions, break it into short numbered "
        "steps, one instruction per step. Never invent form fields or "
        "government rules you are not given — if you're unsure, say so and "
        "suggest they check the official form instructions or the issuing "
        "agency.{form_context}"
    ),
    "tl": (
        "Ikaw ang AXIS Form Assistant, na nakapaloob sa isang tool para sa "
        "pagsagot ng mga government form. Tulungan mong sagutan nang tama at "
        "may kumpiyansa ang user. Maging maikli, malinaw, at nakakapagbigay-"
        "lakas ng loob ang iyong sagot. Kapag ang sagot mo ay isang sunod-"
        "sunod na hakbang, hatiin ito sa maiikling bilang na hakbang, isang "
        "utos bawat hakbang. Huwag kang gagawa-gawa ng field o government "
        "rule na hindi ibinigay sa iyo — kung hindi ka sigurado, sabihin mo "
        "ito at imungkahi na tingnan ang opisyal na instructions ng form o "
        "ang ahensyang naglabas nito. Sumagot ka nang buo sa Tagalog."
        "{form_context}"
    ),
}

STEP_LINE_PATTERN = re.compile(r"^\s*(?:\d+[\.\)]|[-*•])\s+(.*)")


@dataclass
class ChatTurn:
    role: str  # "user" | "assistant"
    text: str


@dataclass
class FormContext:
    form_id: str | None = None
    form_title: str | None = None
    current_field_label: str | None = None


@dataclass
class ChatbotReply:
    reply: str
    steps: list[str] = field(default_factory=list)
    model_used: str | None = None


class ChatbotService:
    def __init__(self) -> None:
        # Adapters are cheap to construct (they just read env vars), so a
        # fresh instance per call keeps this service stateless/thread-safe.
        self._adapter_classes = ADAPTERS

    def _build_system_prompt(self, language: str, form_context: FormContext | None) -> str:
        template = SYSTEM_PROMPT_TEMPLATE.get(language, SYSTEM_PROMPT_TEMPLATE["en"])

        context_note = ""
        if form_context and (form_context.form_title or form_context.current_field_label):
            pieces = []
            if form_context.form_title:
                pieces.append(f'form: "{form_context.form_title}"')
            if form_context.current_field_label:
                pieces.append(f'current field: "{form_context.current_field_label}"')
            context_note = " Context — " + ", ".join(pieces) + "."

        return template.format(form_context=context_note)

    def _build_messages(
        self,
        message: str,
        language: str,
        form_context: FormContext | None,
        history: list[ChatTurn],
    ) -> list[dict]:
        messages = [{"role": "system", "content": self._build_system_prompt(language, form_context)}]
        for turn in history:
            role = "assistant" if turn.role == "assistant" else "user"
            messages.append({"role": role, "content": turn.text})
        messages.append({"role": "user", "content": message})
        return messages

    def _extract_steps(self, reply: str) -> list[str]:
        """Pull out a numbered/bulleted list if the model produced one,
        so the UI can render it as discrete steps instead of one blob."""
        steps: list[str] = []
        for line in reply.splitlines():
            m = STEP_LINE_PATTERN.match(line)
            if m:
                cleaned = m.group(1).strip()
                if cleaned:
                    steps.append(cleaned)
        # Require at least 2 matched lines to call it a "step list" —
        # a single bullet is probably just a stray line, not a procedure.
        return steps if len(steps) >= 2 else []

    async def _call_with_retry(self, provider: str, messages: list[dict]) -> str:
        adapter_cls = self._adapter_classes[provider]
        adapter = adapter_cls()

        last_error: ChatAdapterError | None = None
        for attempt in range(MAX_RETRIES_PER_PROVIDER + 1):
            try:
                return await adapter.complete(messages)
            except ChatAdapterError as exc:
                last_error = exc
                is_rate_limited = exc.status_code == 429
                if is_rate_limited and attempt < MAX_RETRIES_PER_PROVIDER:
                    logger.warning(
                        "chatbot: %s rate-limited, retrying in %ss",
                        provider,
                        RETRY_DELAY_SECONDS,
                    )
                    await asyncio.sleep(RETRY_DELAY_SECONDS)
                    continue
                break

        assert last_error is not None
        raise last_error

    async def get_reply(
        self,
        *,
        message: str,
        language: str,
        preferred_model: str,
        form_context: FormContext | None = None,
        history: list[ChatTurn] | None = None,
    ) -> ChatbotReply:
        messages = self._build_messages(message, language, form_context, history or [])

        # Try the user's chosen model first, then fall back through the
        # rest of FALLBACK_ORDER (skipping the one already attempted),
        # per System_Architecture_Specification.md §5.
        provider_order = [preferred_model] + [
            p for p in FALLBACK_ORDER if p != preferred_model
        ]

        errors: list[str] = []
        for provider in provider_order:
            if provider not in self._adapter_classes:
                continue
            try:
                reply_text = await self._call_with_retry(provider, messages)
                return ChatbotReply(
                    reply=reply_text,
                    steps=self._extract_steps(reply_text),
                    model_used=provider,
                )
            except ChatAdapterError as exc:
                logger.error("chatbot: %s failed: %s", provider, exc)
                errors.append(str(exc))
                continue

        # Every provider failed — surface a clean error to the API layer
        # rather than letting an adapter exception bubble up raw.
        raise ChatAdapterError(
            "chatbot_service",
            f"All providers failed. Details: {'; '.join(errors)}",
        )
