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


@app.get("/")
async def root():
    return {
        "message": "A.X.I.S. Backend is running",
        "health_check": "/api/health",
        "docs": "/docs",
    }