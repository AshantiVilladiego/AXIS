import logging
import asyncio

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
async def health_check():
	"""
	Lightweight API health check that confirms the backend process is running.
	"""
	return {
		"status": "online",
		"message": "A.X.I.S. API Engine is operational",
		"service": "A.X.I.S. Backend v1.0.0",
	}


@router.get("/db-check")
async def db_check(db: AsyncSession = Depends(get_db)):
	"""
	Dedicated database connectivity check.

	This endpoint executes a very small query with a timeout so you can prove
	whether the backend can really reach PostgreSQL.
	"""
	try:
		await asyncio.wait_for(db.execute(text("SELECT 1")), timeout=5.0)
		return {
			"status": "online",
			"database": "connected",
			"message": "Database connection is working",
		"service": "A.X.I.S. Backend v1.0.0",
	}
	except Exception as exc:
		logger.exception("Database check failed")
		return {
			"status": "degraded",
			"database": "disconnected",
			"message": "Database connection failed",
			"service": "A.X.I.S. Backend v1.0.0",
			"error": str(exc),
		}
