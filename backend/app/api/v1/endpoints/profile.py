import uuid
import json
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.session import get_db
from app.core.auth import get_current_user_id

router = APIRouter(tags=["profile"])

@router.get("")
async def get_profile(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Fetches the user's saved profile data."""
    query = text("SELECT profile_data FROM user_profiles WHERE user_id = :user_id")
    result = await db.execute(query, {"user_id": user_id})
    row = result.fetchone()
    
    if not row:
        return {"data": {}}
        
    return {"data": row[0] if isinstance(row[0], dict) else json.loads(row[0])}

@router.post("")
async def upsert_profile(
    payload: dict = Body(...),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Creates or updates the user's profile data."""
    
    # 1. Add explicit type casting to the SQL query (::uuid and ::jsonb)
    query = text("""
        INSERT INTO user_profiles (id, user_id, profile_data, updated_at)
        VALUES (CAST(:id AS uuid), CAST(:user_id AS uuid), CAST(:profile_data AS jsonb), NOW())
        ON CONFLICT (user_id) DO UPDATE 
        SET profile_data = CAST(:profile_data AS jsonb), updated_at = NOW()
    """)
    
    try:
        await db.execute(query, {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "profile_data": json.dumps(payload.get("data", {}))
        })
        await db.commit()
        return {"status": "success", "message": "Profile updated."}
        
    except Exception as e:
        # 2. Add error logging so we can see EXACTLY what fails in the terminal
        import logging
        logging.error(f"Database insertion failed: {e}")
        raise HTTPException(status_code=500, detail="Database insertion failed")