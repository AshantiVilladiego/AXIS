import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel

from app.core.auth import get_current_user_id
from app.db.session import get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["history"])

class HistoryRecord(BaseModel):
    id: str
    name: str
    type: str
    date: str
    score: float
    status: str
    file_url: str

@router.get("/", response_model=List[HistoryRecord])
async def get_processing_history(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """
    Fetch all processed documents for the current user.
    Joins the extracted_fields table to calculate the average AI confidence score.
    """
    query = text("""
        SELECT 
            f.id::text, 
            f.filename as name, 
            f.form_type as type, 
            f.uploaded_at as date, 
            f.status,
            f.file_url,
            COALESCE(AVG(ef.confidence_score) * 100, 0) as score
        FROM forms f
        LEFT JOIN extracted_fields ef ON f.id = ef.form_id
        WHERE f.user_id = :user_id
        GROUP BY f.id
        ORDER BY f.uploaded_at DESC
    """)
    
    try:
        result = await db.execute(query, {"user_id": user_id})
        rows = result.fetchall()
        
        history = []
        for row in rows:
            history.append(
                HistoryRecord(
                    id=row.id,
                    name=row.name,
                    type=row.type,
                    # Format standard ISO strings safely for the frontend
                    date=row.date.isoformat() if row.date else "",
                    score=float(row.score),
                    status=row.status,
                    file_url=row.file_url
                )
            )
        
        return history
    except Exception as e:
        logger.exception("Failed to fetch history for user %s", user_id)
        raise HTTPException(status_code=500, detail="Could not retrieve processing history")