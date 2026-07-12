from pydantic import BaseModel, HttpUrl, Field
from typing import Any, Optional, List
from uuid import UUID
from datetime import datetime

# --- 1. Form Schema ---
class FormCreate(BaseModel):
    """Validates the core document data before hitting the 'forms' table."""
    user_id: UUID
    filename: str
    # CRITICAL FIX: Made Optional so deferred file uploads don't trigger a 500 ResponseValidationError
    file_url: Optional[HttpUrl] = None 
    
# --- 2. Extracted Field Schema ---
class ExtractedFieldCreate(BaseModel):
    """Validates the AI output before hitting the 'extracted_fields' table."""
    field_name: str
    # Extracted values can be deeply nested (dicts of dicts, lists of dicts)
    # depending on the form's structure — not just flat strings. `Any` lets
    # FastAPI serialize whatever the AI adapter returns as real JSON instead
    # of rejecting nested objects with a ResponseValidationError.
    extracted_value: Optional[Any] = None
    confidence_score: Optional[float] = Field(None, ge=0.0, le=1.0) # Ensures score is between 0 and 1

# --- 3. Combined Payload ---
class DocumentExtractionResponse(BaseModel):
    """The master schema: what the frontend receives after a successful AI run."""
    id: str  # <--- THE CRITICAL FIX: FastAPI will now allow the ID to pass through
    form_details: FormCreate
    extracted_data: List[ExtractedFieldCreate]
    # Top-level group names (e.g. "registrant_name") that the AI tagged as
    # describing the applicant themselves, as opposed to a relative's or
    # beneficiary's field (father_name, mother_name, spouse_name, children,
    # ...). Used by the frontend to stop profile auto-fill from bleeding
    # onto e.g. father_name.lastname just because the leaf name matches.
    self_field_groups: List[str] = Field(default_factory=list)
    # Echoes back the form_type the caller submitted (or the AI's
    # auto-detected type, once auto-detection exists) so the frontend can
    # show it without separately tracking request state.
    form_type: str
    # "success" if the AI returned parseable structured data, "failed" if
    # the provider responded but its output couldn't be parsed as JSON
    # (see DocumentService._normalize_extraction / the ai_results fallback).
    status: str