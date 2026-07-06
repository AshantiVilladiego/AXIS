import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel

from app.core.auth import get_current_user_id
from app.db.session import get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["users"])

class UserSettingsResponse(BaseModel):
    ai_failover: bool
    email_notifications: bool

class UserSettingsUpdate(BaseModel):
    ai_failover: bool | None = None
    email_notifications: bool | None = None

@router.get("/settings", response_model=UserSettingsResponse)
async def get_user_settings(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Fetch the current user's profile settings from the database."""
    query = text("""
        SELECT ai_failover, email_notifications 
        FROM profiles 
        WHERE id = :user_id
    """)
    
    result = await db.execute(query, {"user_id": user_id})
    row = result.fetchone()
    
    if not row:
        # If the user doesn't have a profile yet (missing trigger), return safe defaults
        return {"ai_failover": True, "email_notifications": False}
        
    return {
        "ai_failover": row.ai_failover if row.ai_failover is not None else True,
        "email_notifications": row.email_notifications if row.email_notifications is not None else False
    }

@router.patch("/settings", response_model=UserSettingsResponse)
async def update_user_settings(
    settings_update: UserSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Update the current user's profile settings in the database."""
    update_fields = []
    params = {"user_id": user_id}
    
    if settings_update.ai_failover is not None:
        update_fields.append("ai_failover = :ai_failover")
        params["ai_failover"] = settings_update.ai_failover
        
    if settings_update.email_notifications is not None:
        update_fields.append("email_notifications = :email_notifications")
        params["email_notifications"] = settings_update.email_notifications
        
    if not update_fields:
        return await get_user_settings(db=db, user_id=user_id)
        
    query = text(f"""
        UPDATE profiles 
        SET {", ".join(update_fields)} 
        WHERE id = :user_id 
        RETURNING ai_failover, email_notifications
    """)
    
    try:
        result = await db.execute(query, params)
        row = result.fetchone()
        await db.commit()
        
        if not row:
            raise HTTPException(status_code=404, detail="User profile not found. Please ensure your profile is initialized.")
            
        return {
            "ai_failover": row.ai_failover,
            "email_notifications": row.email_notifications
        }
    except Exception as e:
        await db.rollback()
        logger.exception("Failed to update user settings for user %s", user_id)
        raise HTTPException(status_code=500, detail="Database update failed")