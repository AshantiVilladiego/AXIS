import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from app.services.document_service import DocumentService # <--- ADD THIS IMPORT

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
    
@router.get("/signed-url/{file_path:path}")
async def get_signed_url(
    file_path: str,
    user_id: str = Depends(get_current_user_id),
):
    if not file_path.startswith(user_id):
        raise HTTPException(status_code=403, detail="Unauthorized.")

    try:
        service = DocumentService()
        result = service.supabase.storage.from_("documents").create_signed_url(
            path=file_path,
            expires_in=3600
        )
        signed_url = result.get("signedURL") or result.get("signed_url")
        if not signed_url:
            logger.error("Unexpected signed URL response shape: %r", result)
            raise HTTPException(status_code=500, detail="Failed to generate signed URL.")
        return {"url": signed_url}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Signed URL generation failed for path %s", file_path)
        raise HTTPException(status_code=500, detail="Failed to generate signed URL.")
    
@router.delete("/{form_id}")
async def delete_form(
    form_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    # Security: Verify the form belongs to the user before deleting
    query = text("DELETE FROM forms WHERE id = :id AND user_id = :user_id")
    result = await db.execute(query, {"id": form_id, "user_id": user_id})
    await db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Form not found or unauthorized.")
        
    return {"message": "Form deleted successfully"}