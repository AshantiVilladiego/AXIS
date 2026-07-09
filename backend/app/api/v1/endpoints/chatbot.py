from __future__ import annotations
from typing import Literal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import re

from app.adapters.chat_adapters import ChatAdapterError
from app.services.chatbot_service import ChatbotService, ChatTurn, FormContext

router = APIRouter(prefix="/api/chatbot", tags=["chatbot"])

_service = ChatbotService()

ChatLanguage = Literal["en", "tl"]
ChatModelProvider = Literal["gemini", "groq", "huggingface"]

# --- MASTER HUMANIZER DICTIONARY (Localized for PH Forms - Bilingual) ---
FRIENDLY_LABELS = {
    "firstname": {"label": "First Name", "guide_en": "What is your given name?", "guide_tl": "Ano po ang inyong given name (First Name)?"},
    "lastname": {"label": "Last Name", "guide_en": "What is your Last Name / Surname?", "guide_tl": "Ano po ang inyong apelyido (Last Name)?"},
    "middlename": {"label": "Middle Name", "guide_en": "What is your Middle Name? If none, type 'N/A'.", "guide_tl": "Ano po ang inyong Middle Name? Kung wala, i-type ang 'N/A'."},
    "suffix": {"label": "Name Suffix", "guide_en": "Do you have a suffix? (e.g., 'Jr.', 'Sr.', 'III'). If none, type 'N/A'.", "guide_tl": "Mayroon po ba kayong suffix? (Hal. 'Jr.', 'Sr.', 'III'). Kung wala, i-type ang 'N/A'."},
    
    "houselotblkno": {"label": "House / Lot / Block No.", "guide_en": "What is your House/Lot/Block No.? (e.g., 'Blk 4 Lot 15').", "guide_tl": "Ano po ang inyong House/Lot/Block No.? (Hal. 'Blk 4 Lot 15')."},
    "streetname": {"label": "Street Name", "guide_en": "Which street do you live on?", "guide_tl": "Saang kalye po kayo nakatira?"},
    "barangaydistrictlocality": {"label": "Barangay", "guide_en": "Which Barangay do you live in?", "guide_tl": "Anong Barangay po kayo nakatira?"},
    "citymunicipality": {"label": "City / Municipality", "guide_en": "Which City or Municipality do you live in?", "guide_tl": "Saang Lungsod o Munisipalidad po kayo?"},
    "province": {"label": "Province", "guide_en": "Which Province do you live in?", "guide_tl": "Saang Probinsya po kayo?"},
    "zipcode": {"label": "ZIP Code", "guide_en": "What is your 4-digit ZIP Code? (e.g., '1008').", "guide_tl": "Ano po ang inyong 4-digit ZIP Code?"},
    "citymunicipalityprovince": {"label": "City & Province", "guide_en": "Please provide your City and Province.", "guide_tl": "Ano po ang inyong Lungsod at Probinsya?"},
    "country": {"label": "Country", "guide_en": "Which country do you currently reside in?", "guide_tl": "Saang bansa po kayo kasalukuyang nakatira?"},
    
    "ssnumber": {"label": "SSS Number", "guide_en": "Type your 10-digit SSS Number (e.g., '01-2345678-9').", "guide_tl": "I-type ang inyong 10-digit SSS Number (Hal. '01-2345678-9')."},
    "sssnumber": {"label": "SSS Number", "guide_en": "Type your 10-digit SSS Number (e.g., '01-2345678-9').", "guide_tl": "I-type ang inyong 10-digit SSS Number (Hal. '01-2345678-9')."},
    "taxidentificationnumber": {"label": "TIN (Tax Identification Number)", "guide_en": "Type your TIN.", "guide_tl": "I-type ang inyong TIN."},
    "philhealth": {"label": "PhilHealth Number", "guide_en": "Type your 12-digit PhilHealth Number.", "guide_tl": "I-type ang inyong 12-digit PhilHealth Number."},
    "pagibignumber": {"label": "Pag-IBIG MID Number", "guide_en": "Type your 12-digit Pag-IBIG MID Number.", "guide_tl": "I-type ang inyong 12-digit Pag-IBIG MID Number."},
    
    "dateofbirth": {"label": "Date of Birth", "guide_en": "When is your birthday? Format: MM/DD/YYYY.", "guide_tl": "Kailan po ang inyong birthday? Format: MM/DD/YYYY."},
    "civilstatus": {"label": "Civil Status", "guide_en": "What is your civil status?", "guide_tl": "Ano po ang inyong civil status?", "options": ["Single", "Married", "Widowed", "Legally Separated"]},
    "sex": {"label": "Sex / Gender", "guide_en": "What is your sex/gender?", "guide_tl": "Ano po ang inyong kasarian?", "options": ["Male", "Female"]},
    "mobilecellphonenumber": {"label": "Mobile Number", "guide_en": "Type your 11-digit mobile number.", "guide_tl": "I-type ang inyong 11-digit mobile number."},
    "telephonenumber": {"label": "Telephone Number", "guide_en": "Type your landline/telephone number. If none, type 'N/A'.", "guide_tl": "I-type ang inyong landline number. Kung wala, i-type ang 'N/A'."},
    "emailaddress": {"label": "Email Address", "guide_en": "Type your active email address.", "guide_tl": "I-type ang inyong active email address."},
    
    "nationality": {"label": "Nationality", "guide_en": "What is your nationality? (e.g., Filipino)", "guide_tl": "Ano po ang inyong nasyonalidad? (Hal. Filipino)"},
    "religion": {"label": "Religion", "guide_en": "What is your religion? (e.g., Roman Catholic)", "guide_tl": "Ano po ang inyong relihiyon? (Hal. Roman Catholic)"},
    "relationship": {"label": "Relationship", "guide_en": "What is your relationship to your dependent? (e.g., Spouse, Child).", "guide_tl": "Ano po ang relasyon ninyo sa inyong dependent? (Halimbawa: Asawa, Anak, Nanay, Tatay)."}
}

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
    field_name: str
    language: str = "en"
    model: str = "gemini"
    form_id: str | None = None

class FieldQuestionResponse(BaseModel):
    reply: str
    guide: str | None = None
    options: list[str] | None = None

@router.post("/message", response_model=ChatMessageResponse)
async def send_chat_message(payload: ChatMessageRequest) -> ChatMessageResponse:
    form_context = None
    if payload.formContext:
        form_context = FormContext(
            form_id=payload.formContext.formId, form_title=payload.formContext.formTitle,
            current_field_label=payload.formContext.currentFieldLabel,
        )
    history = [ChatTurn(role=turn.role, text=turn.text) for turn in payload.history]
    try:
        result = await _service.get_reply(
            message=payload.message, language=payload.language, preferred_model=payload.model,
            form_context=form_context, history=history,
        )
    except ChatAdapterError as exc:
        raise HTTPException(status_code=502, detail="AI provider error.") from exc
    return ChatMessageResponse(reply=result.reply, steps=result.steps or None, modelUsed=result.model_used)

@router.post("/field-question", response_model=FieldQuestionResponse)
async def ask_about_field(payload: FieldQuestionRequest) -> FieldQuestionResponse:
    raw_key = payload.field_name
    normalized_key = re.sub(r'[^a-z0-9]', '', raw_key.lower())
    lang = payload.language
    
    field_info = FRIENDLY_LABELS.get(normalized_key)
    if not field_info:
        for known_key, info in FRIENDLY_LABELS.items():
            if known_key in normalized_key:
                field_info = info
                break

    if field_info:
        reply_text = f"Ano po ang inyong {field_info['label']}?" if lang == "tl" else f"What is your {field_info['label']}?"
        guide_text = field_info.get(f"guide_{lang}", field_info.get("guide_en"))
        return FieldQuestionResponse(reply=reply_text, guide=guide_text, options=field_info.get("options"))
    
    spaced_label = re.sub(r'([A-Z])', r' \1', raw_key).replace('_', ' ').title().strip()
    clean_spaced_label = re.sub(r'\d+', '', spaced_label).replace('  ', ' ').strip()
    
    reply_text = f"Ano po ang inyong {clean_spaced_label}?" if lang == "tl" else f"What is your {clean_spaced_label}?"
    guide_text = f"Paki-lagay po ang inyong {clean_spaced_label}." if lang == "tl" else f"Please provide your {clean_spaced_label}."
    
    return FieldQuestionResponse(reply=reply_text, guide=guide_text, options=None)