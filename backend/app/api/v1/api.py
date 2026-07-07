from fastapi import APIRouter

from app.api.v1.endpoints.forms import router as forms_router
from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.users import router as users_router
from app.api.v1.endpoints.history import router as history_router
from app.api.v1.endpoints.profile import router as profile_router

api_router = APIRouter()

api_router.include_router(health_router)
api_router.include_router(forms_router)
api_router.include_router(users_router, prefix="/api/users")
api_router.include_router(history_router, prefix="/api/history")
api_router.include_router(profile_router, prefix="/profile", tags=["profile"])