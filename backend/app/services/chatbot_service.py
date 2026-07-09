from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass, field

from app.adapters.chat_adapters import ADAPTERS, FALLBACK_ORDER, ChatAdapterError
from app.services.fixed_prompts import get_fixed_answer

logger = logging.getLogger(__name__)

RETRY_DELAY_SECONDS = 5
MAX_RETRIES_PER_PROVIDER = 1

# --- THE FIX: Banned Signature/Physical Requests ---
SYSTEM_PROMPT_TEMPLATE = {
    "en": (
        "You are the AXIS Form Assistant, embedded in a government-form "
        "completion tool. Help the user fill out their form correctly. "
        "CRITICAL: Never ask the user to type in their signature, thumbprint, "
        "or dates of signature — these are physical actions they must do by hand "
        "after printing. Break your instructions into short numbered steps. "
        "Never invent form fields.{form_context}"
    ),
    "tl": (
        "Ikaw ang AXIS Form Assistant. Tulungan mong sagutan nang tama ang user. "
        "CRITICAL: Huwag kailanman hingin sa user na i-type ang kanilang pirma, "
        "thumbprint, o petsa ng pagpirma — ito ay mga pisikal na aksyon na "
        "dapat nilang gawin sa papel pagkatapos i-print. Hatiin sa maiikling "
        "bilang na hakbang ang iyong utos. Sumagot nang buo sa Tagalog.{form_context}"
    ),
}

STEP_LINE_PATTERN = re.compile(r"^\s*(?:\d+[\.\)]|[-*•])\s+(.*)")

FIELD_QUESTION_INSTRUCTION = {
    "en": (
        "The user is filling out {form_title_note}a government form and the "
        "following field still needs a value: \"{field_label}\". "
        "Respond using exactly this tagged format:\n"
        "[GUIDE] one short, plain-language sentence explaining what to enter.\n"
        "[OPTIONS] a comma-separated list of the standardized valid answers for "
        "this field — OMIT this tag entirely if the field is free text.\n"
        "[QUESTION] a short, friendly question asking the user for this field.\n"
    ),
    "tl": (
        "Sinasagutan ng user ang {form_title_note}isang government form at "
        "kailangan pa ng value ang field na: \"{field_label}\". "
        "Sumagot gamit ang eksaktong format na ito:\n"
        "[GUIDE] isang maikli, simpleng pangungusap na nagpapaliwanag kung ano ang ilalagay.\n"
        "[OPTIONS] comma-separated na listahan ng valid na sagot — ALISIN ang tag na ito kung free text.\n"
        "[QUESTION] maikli at magiliw na tanong para hingin ang field.\n"
    ),
}

@dataclass
class ChatTurn:
    role: str
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
    guide: str | None = None
    options: list[str] = field(default_factory=list)


class ChatbotService:
    _GUIDE_RE = re.compile(r"\[GUIDE\]\s*(.*?)(?=\[OPTIONS\]|\[QUESTION\]|$)", re.S)
    _OPTIONS_RE = re.compile(r"\[OPTIONS\]\s*(.*?)(?=\[QUESTION\]|$)", re.S)
    _QUESTION_RE = re.compile(r"\[QUESTION\]\s*(.*)$", re.S)

    def __init__(self) -> None:
        self._adapter_classes = ADAPTERS

    def _build_system_prompt(self, language: str, form_context: FormContext | None) -> str:
        template = SYSTEM_PROMPT_TEMPLATE.get(language, SYSTEM_PROMPT_TEMPLATE["en"])
        context_note = ""
        if form_context and (form_context.form_title or form_context.current_field_label):
            pieces = []
            if form_context.form_title: pieces.append(f'form: "{form_context.form_title}"')
            if form_context.current_field_label: pieces.append(f'current field: "{form_context.current_field_label}"')
            context_note = " Context — " + ", ".join(pieces) + "."
        return template.format(form_context=context_note)

    def _build_messages(self, message: str, language: str, form_context: FormContext | None, history: list[ChatTurn]) -> list[dict]:
        messages = [{"role": "system", "content": self._build_system_prompt(language, form_context)}]
        for turn in history:
            messages.append({"role": "assistant" if turn.role == "assistant" else "user", "content": turn.text})
        messages.append({"role": "user", "content": message})
        return messages

    def _extract_steps(self, reply: str) -> list[str]:
        steps: list[str] = []
        for line in reply.splitlines():
            m = STEP_LINE_PATTERN.match(line)
            if m and m.group(1).strip(): steps.append(m.group(1).strip())
        return steps if len(steps) >= 2 else []

    def _parse_tagged_reply(self, text: str) -> tuple[str | None, list[str], str]:
        guide_match = self._GUIDE_RE.search(text)
        options_match = self._OPTIONS_RE.search(text)
        question_match = self._QUESTION_RE.search(text)

        guide = guide_match.group(1).strip() if guide_match else None
        options = [o.strip() for o in options_match.group(1).split(",") if o.strip()] if options_match else []
        question = question_match.group(1).strip() if question_match else re.sub(r"\[(GUIDE|OPTIONS|QUESTION)\]", "", text).strip()
        return guide, options, question

    async def _call_with_retry(self, provider: str, messages: list[dict]) -> str:
        adapter = self._adapter_classes[provider]()
        last_error = None
        for attempt in range(MAX_RETRIES_PER_PROVIDER + 1):
            try:
                return await adapter.complete(messages)
            except ChatAdapterError as exc:
                last_error = exc
                if exc.status_code == 429 and attempt < MAX_RETRIES_PER_PROVIDER:
                    await asyncio.sleep(RETRY_DELAY_SECONDS)
                    continue
                break
        raise last_error

    async def _run_provider_chain(self, messages: list[dict], preferred_model: str) -> tuple[str, str]:
        provider_order = [preferred_model] + [p for p in FALLBACK_ORDER if p != preferred_model]
        errors = []
        for provider in provider_order:
            if provider not in self._adapter_classes: continue
            try:
                reply_text = await self._call_with_retry(provider, messages)
                return reply_text, provider
            except ChatAdapterError as exc:
                errors.append(str(exc))
                continue
        raise ChatAdapterError("chatbot_service", f"All providers failed. Details: {'; '.join(errors)}")

    async def get_reply(self, *, message: str, language: str, preferred_model: str, form_context: FormContext | None = None, history: list[ChatTurn] | None = None) -> ChatbotReply:
        messages = self._build_messages(message, language, form_context, history or [])
        reply_text, provider = await self._run_provider_chain(messages, preferred_model)
        return ChatbotReply(reply=reply_text, steps=self._extract_steps(reply_text), model_used=provider)

    async def get_field_question(self, *, field_name: str, language: str = "en", preferred_model: str, field_label: str | None = None, form_context: FormContext | None = None) -> ChatbotReply:
        label = field_label or field_name.replace("_", " ")
        instruction = FIELD_QUESTION_INSTRUCTION.get(language, FIELD_QUESTION_INSTRUCTION["en"]).format(
            field_label=label, 
            form_title_note=f'the "{form_context.form_title}" ' if form_context and form_context.form_title else ""
        )
        messages = self._build_messages(instruction, language, form_context, [])
        reply_text, provider = await self._run_provider_chain(messages, preferred_model)
        guide, options, question = self._parse_tagged_reply(reply_text)
        return ChatbotReply(reply=question, steps=[], model_used=provider, guide=guide, options=options)