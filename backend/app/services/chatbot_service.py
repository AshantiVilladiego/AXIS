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

# Instruction appended as a one-off user turn (not the system prompt) when
# we need the model to ask about a single missing field. Keeping it out of
# the system prompt means normal free-chat replies never accidentally pick
# up the tagged format.
FIELD_QUESTION_INSTRUCTION = {
    "en": (
        "The user is filling out {form_title_note}a government form and the "
        "following field still needs a value: \"{field_label}\". "
        "Respond using exactly this tagged format, each tag starting a new segment:\n"
        "[GUIDE] one short, plain-language sentence explaining what to enter.\n"
        "[OPTIONS] a comma-separated list of the standardized valid answers for "
        "this field (e.g. Single, Married, Widowed) — OMIT this tag entirely if "
        "the field is free text with no fixed set of answers (e.g. a name, "
        "address, or ID number).\n"
        "[QUESTION] a short, friendly question asking the user for this field.\n"
        "Do not add any text before [GUIDE] or after the question, and do not "
        "explain the format — just produce the three tags."
    ),
    "tl": (
        "Sinasagutan ng user ang {form_title_note}isang government form at "
        "kailangan pa ng value ang field na: \"{field_label}\". "
        "Sumagot gamit ang eksaktong format na ito, bawat tag ay nagsisimula "
        "ng bagong segment:\n"
        "[GUIDE] isang maikli, simpleng pangungusap na nagpapaliwanag kung ano "
        "ang ilalagay.\n"
        "[OPTIONS] comma-separated na listahan ng standardized na valid na "
        "sagot para sa field na ito (hal. Single, Married, Widowed) — ALISIN "
        "ang tag na ito kung ang field ay free text na walang nakatakdang "
        "listahan ng sagot (hal. pangalan, address, o ID number).\n"
        "[QUESTION] maikli at magiliw na tanong para hingin ang field na ito "
        "mula sa user.\n"
        "Huwag magdagdag ng anumang teksto bago ang [GUIDE] o pagkatapos ng "
        "tanong, at huwag ipaliwanag ang format — ilabas lang ang tatlong tag."
    ),
}


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
    # Populated only by get_field_question() via the [GUIDE]/[OPTIONS] tags —
    # guide is a short hint, options is the quick-select chip list (empty
    # when the field is free text with no fixed set of valid answers).
    guide: str | None = None
    options: list[str] = field(default_factory=list)


class ChatbotService:
    _GUIDE_RE = re.compile(r"\[GUIDE\]\s*(.*?)(?=\[OPTIONS\]|\[QUESTION\]|$)", re.S)
    _OPTIONS_RE = re.compile(r"\[OPTIONS\]\s*(.*?)(?=\[QUESTION\]|$)", re.S)
    _QUESTION_RE = re.compile(r"\[QUESTION\]\s*(.*)$", re.S)

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

    def _parse_tagged_reply(self, text: str) -> tuple[str | None, list[str], str]:
        """Extracts the [GUIDE]/[OPTIONS]/[QUESTION] segments requested by
        FIELD_QUESTION_INSTRUCTION. Never trust a model to follow a format
        100% of the time — if [QUESTION] is missing we fall back to the
        whole reply (with any stray tag markers stripped) so the user still
        gets a usable message instead of an empty string."""
        guide_match = self._GUIDE_RE.search(text)
        options_match = self._OPTIONS_RE.search(text)
        question_match = self._QUESTION_RE.search(text)

        guide = guide_match.group(1).strip() if guide_match else None
        options = (
            [o.strip() for o in options_match.group(1).split(",") if o.strip()]
            if options_match else []
        )

        if question_match:
            question = question_match.group(1).strip()
        else:
            question = re.sub(r"\[(GUIDE|OPTIONS|QUESTION)\]", "", text).strip()

        return guide, options, question

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

    async def _run_provider_chain(
        self, messages: list[dict], preferred_model: str
    ) -> tuple[str, str]:
        """Tries preferred_model first, then the rest of FALLBACK_ORDER
        (skipping the one already attempted), per
        System_Architecture_Specification.md §5. Shared by get_reply() and
        get_field_question() so both go through the same fallback policy.
        Returns (reply_text, provider_used); raises ChatAdapterError if
        every provider in the chain fails.
        """
        provider_order = [preferred_model] + [
            p for p in FALLBACK_ORDER if p != preferred_model
        ]

        errors: list[str] = []
        for provider in provider_order:
            if provider not in self._adapter_classes:
                continue
            try:
                reply_text = await self._call_with_retry(provider, messages)
                return reply_text, provider
            except ChatAdapterError as exc:
                logger.error("chatbot: %s failed: %s", provider, exc)
                errors.append(str(exc))
                continue

        raise ChatAdapterError(
            "chatbot_service",
            f"All providers failed. Details: {'; '.join(errors)}",
        )

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
        reply_text, provider = await self._run_provider_chain(messages, preferred_model)
        return ChatbotReply(
            reply=reply_text,
            steps=self._extract_steps(reply_text),
            model_used=provider,
        )

    async def get_field_question(
        self,
        *,
        field_name: str,
        language: str = "en",
        preferred_model: str,
        field_label: str | None = None,
        form_context: FormContext | None = None,
    ) -> ChatbotReply:
        """Asks the model to produce a guide + (optional) options + question
        for a single missing form field, using the
        [GUIDE]/[OPTIONS]/[QUESTION] tagged protocol.

        This is what lets the UI render dynamic quick-select chips without
        us hardcoding every field's valid answers in the frontend — the
        model decides, per field, whether a fixed set of answers exists and
        what they are.
        """
        label = field_label or field_name.replace("_", " ")
        instruction_template = FIELD_QUESTION_INSTRUCTION.get(
            language, FIELD_QUESTION_INSTRUCTION["en"]
        )
        form_title_note = (
            f'the "{form_context.form_title}" '
            if form_context and form_context.form_title
            else ""
        )
        instruction = instruction_template.format(
            field_label=label, form_title_note=form_title_note
        )

        # No history here — each field question is a fresh, isolated
        # request so earlier chat turns can't bleed formatting quirks into
        # the tagged output.
        messages = self._build_messages(instruction, language, form_context, [])
        reply_text, provider = await self._run_provider_chain(messages, preferred_model)

        guide, options, question = self._parse_tagged_reply(reply_text)
        return ChatbotReply(
            reply=question,
            steps=[],
            model_used=provider,
            guide=guide,
            options=options,
        )