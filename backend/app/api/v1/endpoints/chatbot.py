from __future__ import annotations
from typing import Literal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.adapters.chat_adapters import ChatAdapterError
from app.services.chatbot_service import ChatbotService, ChatTurn, FormContext
from app.utils.label_humanizer import humanize_field

router = APIRouter(prefix="/api/chatbot", tags=["chatbot"])

_service = ChatbotService()

ChatLanguage = Literal["en", "tl"]
ChatModelProvider = Literal["gemini", "groq", "huggingface"]


class FormContextIn(BaseModel):
    formId: str | None = None
    formTitle: str | None = None
    currentFieldLabel: str | None = None


class HistoryTurnIn(BaseModel):
    role: Literal["user", "assistant"]
    text: str


class ChatMessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    language: ChatLanguage = "en"
    model: ChatModelProvider = "gemini"
    formContext: FormContextIn | None = None
    history: list[HistoryTurnIn] = Field(default_factory=list)


class ChatMessageResponse(BaseModel):
    reply: str
    steps: list[str] | None = None
    modelUsed: ChatModelProvider | None = None


class FieldQuestionRequest(BaseModel):
    field_name: str = Field(min_length=1)
    language: ChatLanguage = "en"
    model: ChatModelProvider = "gemini"
    form_id: str | None = None


class FieldQuestionResponse(BaseModel):
    reply: str
    guide: str | None = None
    options: list[str] | None = None
    modelUsed: ChatModelProvider | None = None


# Leaf-key -> input guide. Kept separate from humanize_field's label
# overrides since a field can need a formatting hint even when its
# label needs no override (and vice versa).
_FIELD_GUIDES: dict[str, str] = {
    "sss_number": "Format: XX-XXXXXXX-X",
    "mobile_number": "e.g. 09171234567 — numbers only, no dashes or spaces.",
    "mobile_cellphone_number": "e.g. 09171234567 — numbers only, no dashes or spaces.",
    "tax_identification_number": "Numbers only, e.g. 123-456-789-000.",
    "zip_code": "4-digit postal code.",
}


def _guide_for(field_name: str, label: str) -> str | None:
    leaf = field_name.split(".")[-1]
    if leaf in _FIELD_GUIDES:
        return _FIELD_GUIDES[leaf]
    if "number" in label.lower():
        return "Please enter only numbers, no dashes or spaces."
    return None


@router.post("/message", response_model=ChatMessageResponse)
async def send_chat_message(payload: ChatMessageRequest) -> ChatMessageResponse:
    form_context = None
    if payload.formContext:
        form_context = FormContext(
            form_id=payload.formContext.formId,
            form_title=payload.formContext.formTitle,
            current_field_label=payload.formContext.currentFieldLabel,
        )

    history = [ChatTurn(role=turn.role, text=turn.text) for turn in payload.history]

    try:
        result = await _service.get_reply(
            message=payload.message,
            language=payload.language,
            preferred_model=payload.model,
            form_context=form_context,
            history=history,
        )
    except ChatAdapterError as exc:
        # Every configured provider failed (bad/missing keys, all rate
        # limited, etc.) — surface a 502 rather than a raw 500.
        raise HTTPException(
            status_code=502,
            detail="The assistant couldn't reach any AI provider right now. Please try again shortly.",
        ) from exc

    return ChatMessageResponse(
        reply=result.reply,
        steps=result.steps or None,
        modelUsed=result.model_used,
    )


@router.post("/field-question", response_model=FieldQuestionResponse)
async def ask_about_field(payload: FieldQuestionRequest) -> FieldQuestionResponse:
    """Return a friendly question for a missing extracted field.

    This is deliberately NOT an LLM call: humanize_field() is a pure,
    deterministic string transform, so the same field_name always
    produces the same question, and there's no fallback path for it to
    silently 404 into (which is what was happening before this route
    existed — the frontend's askAboutField() would hit a 404 here and
    fall back to its own naive client-side label formatting).
    """
    label = humanize_field(payload.field_name)
    return FieldQuestionResponse(
        reply=f"What is your {label}?",
        guide=_guide_for(payload.field_name, label),
        options=None,
        modelUsed=payload.model,
    )