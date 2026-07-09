from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from app.api.v1.endpoints import chatbot
from app.api.v1.api import api_router
from app.core.config import settings
from app.services.fixed_prompts import get_fixed_answer
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.api import api_router
from app.core.config import settings

# Initialize the application
app = FastAPI(title=settings.app_name)

# Configure CORS (Michael's Code - required for React frontend)
# --- BULLETPROOF CORS CONFIGURATION ---
# Hardcoding the local origins prevents Pydantic .env stringification bugs
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(chatbot.router)

# --- Chatbot Data Models ---
class FixedPromptRequest(BaseModel):
    promptType: str
    documentKey: Optional[str] = None
    language: str
    model: str


# --- Chatbot Endpoints ---
@app.post("/api/chatbot/fixed")
async def handle_fixed_prompt(payload: FixedPromptRequest):
    try:
        # Run the dict-lookup logic from your fixed_prompts script
        result = get_fixed_answer(payload.promptType, document_key=payload.documentKey)
        
        # Format the response to match the frontend's ChatResponsePayload interface
        if isinstance(result, dict):
            return {
                "reply": result.get("reply", "No answer found."),
                "steps": result.get("steps", [])
            }
        
        # Fallback if get_fixed_answer just returns a raw string
        return {
            "reply": str(result),
            "steps": []
        }
        
    except Exception as e:
        print(f"[Backend Error] Fixed prompt failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server lookup failed")


@app.get("/")
async def root():
    return {
        "message": "A.X.I.S. Backend is running",
        "health_check": "/api/health",
        "docs": "/docs",
    }