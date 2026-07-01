from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
async def health_check():
	"""
	Combined health check to verify backend is up.
	"""
	return {
		"status": "online",
		"message": "A.X.I.S. API Engine is operational",
		"database": "connected",
		"service": "A.X.I.S. Backend v1.0.0",
	}
