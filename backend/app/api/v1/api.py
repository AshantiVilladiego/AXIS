from fastapi import APIRouter

from app.api.v1.endpoints.forms import router as forms_router
from app.api.v1.endpoints.health import router as health_router

api_router = APIRouter()

api_router.include_router(health_router)
api_router.include_router(forms_router)
