from __future__ import annotations
from typing import Literal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.adapters.chat_adapters import ChatAdapterError
from app.services.chatbot_service import ChatbotService, ChatTurn, FormContext

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
