from pydantic import BaseModel, HttpUrl, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime

# --- 1. Form Schema ---
class FormCreate(BaseModel):
    """Validates the core document data before hitting the 'forms' table."""
    user_id: UUID
    filename: str
    file_url: HttpUrl # Pydantic strictly ensures this is a valid URL format
    
# --- 2. Extracted Field Schema ---
class ExtractedFieldCreate(BaseModel):
    """Validates the AI output before hitting the 'extracted_fields' table."""
    field_name: str
    # Optional fields mirror the hollow diamonds in your ERD
    extracted_value: Optional[str] = None
    confidence_score: Optional[float] = Field(None, ge=0.0, le=1.0) # Ensures score is between 0 and 1

# --- 3. Combined Payload ---
class DocumentExtractionResponse(BaseModel):
    """The master schema: what the frontend receives after a successful AI run."""
    form_details: FormCreate
    extracted_data: List[ExtractedFieldCreate]