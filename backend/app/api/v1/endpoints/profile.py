from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.session import get_db
from app.core.auth import get_current_user_id

router = APIRouter(tags=["profile"])


def parse_date(date_str: str | None):
    """Convert a date string from the frontend into a date object.

    asyncpg needs an actual date object for a DATE column; passing the raw
    string causes AttributeError: 'str' object has no attribute 'toordinal'
    deep inside the driver. Accepts a couple of common formats since not
    every client is guaranteed to send ISO. Returns None (not a raised
    error) for empty or malformed input so a blank/partial payload doesn't
    clobber an existing value via the COALESCE in the upsert.
    """
    if not date_str:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y"):
        try:
            return datetime.strptime(str(date_str).strip(), fmt).date()
        except ValueError:
            continue
    return None


def _clean(value: str | None) -> str | None:
    """Trim and normalize an incoming string field to None if empty, so
    COALESCE on the upsert doesn't treat "" as a real value to save over
    an existing one."""
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


def _join_parts(*parts: str | None, sep: str = " ") -> str | None:
    cleaned = [p for p in (x.strip() if x else None for x in parts) if p]
    return sep.join(cleaned) if cleaned else None


@router.get("")
async def get_profile(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Fetches the user's saved profile data from the profiles table."""
    try:
        query = text("""
            SELECT email, first_name, middle_name, last_name, suffix, birth_date,
                   street, barangay, city, province, zip_code, contact_number,
                   taxpayer_id, sss_number, philhealth_number, pagibig_number
            FROM profiles WHERE id = CAST(:user_id AS uuid)
        """)
        result = await db.execute(query, {"user_id": user_id})
        row = result.fetchone()
    except Exception as e:
        # A DB read failing shouldn't surface as an opaque 500 with no
        # context — the frontend needs a message it can show, and the
        # server log needs the real exception for debugging.
        raise HTTPException(status_code=500, detail=f"Could not load profile: {str(e)}")

    if not row:
        return {"data": {}}

    return {"data": {
        "email": row.email,
        "firstName": row.first_name,
        "middleName": row.middle_name,
        "lastName": row.last_name,
        "suffix": row.suffix,
        "birthDate": row.birth_date.isoformat() if row.birth_date else None,
        "street": row.street,
        "barangay": row.barangay,
        "city": row.city,
        "province": row.province,
        "zipCode": row.zip_code,
        "contactNumber": row.contact_number,
        "tinNumber": row.taxpayer_id,
        "sssNumber": row.sss_number,
        "philhealthNumber": row.philhealth_number,
        "pagibigNumber": row.pagibig_number,
        # Convenience computed fields for anything that still wants a
        # single display string (e.g. a PDF's "Name" line, a greeting).
        # Not stored — always derived from the atomic parts above.
        "fullName": _join_parts(row.first_name, row.middle_name, row.last_name, row.suffix),
        "address": _join_parts(row.street, row.barangay, row.city, row.province, sep=", "),
    }}


@router.post("")
async def upsert_profile(
    payload: dict = Body(...),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Creates or updates the user's profile data in the profiles table.

    Uses INSERT ... ON CONFLICT so a first-time user gets a row created
    automatically, and COALESCE on the conflict branch so a partial payload
    (e.g. a single field captured by the chat wizard) doesn't null out
    fields that were already saved.
    """
    data = payload.get("data", {})
    if not isinstance(data, dict):
        raise HTTPException(status_code=422, detail="Request body 'data' must be an object.")

    params = {
        "user_id": user_id,
        "email": _clean(data.get("email")),
        "first_name": _clean(data.get("firstName")),
        "middle_name": _clean(data.get("middleName")),
        "last_name": _clean(data.get("lastName")),
        "suffix": _clean(data.get("suffix")),
        "birth_date": parse_date(data.get("birthDate")),
        "street": _clean(data.get("street")),
        "barangay": _clean(data.get("barangay")),
        "city": _clean(data.get("city")),
        "province": _clean(data.get("province")),
        "zip_code": _clean(data.get("zipCode")),
        "contact_number": _clean(data.get("contactNumber")),
        "taxpayer_id": _clean(data.get("tinNumber")),
        "sss_number": _clean(data.get("sssNumber")),
        "philhealth_number": _clean(data.get("philhealthNumber")),
        "pagibig_number": _clean(data.get("pagibigNumber")),
    }

    query = text("""
        INSERT INTO profiles (id, email, first_name, middle_name, last_name, suffix, birth_date,
                               street, barangay, city, province, zip_code, contact_number,
                               taxpayer_id, sss_number, philhealth_number, pagibig_number)
        VALUES (CAST(:user_id AS uuid), :email, :first_name, :middle_name, :last_name, :suffix, :birth_date,
                :street, :barangay, :city, :province, :zip_code, :contact_number,
                :taxpayer_id, :sss_number, :philhealth_number, :pagibig_number)
        ON CONFLICT (id) DO UPDATE SET
            email = COALESCE(EXCLUDED.email, profiles.email),
            first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
            middle_name = COALESCE(EXCLUDED.middle_name, profiles.middle_name),
            last_name = COALESCE(EXCLUDED.last_name, profiles.last_name),
            suffix = COALESCE(EXCLUDED.suffix, profiles.suffix),
            birth_date = COALESCE(EXCLUDED.birth_date, profiles.birth_date),
            street = COALESCE(EXCLUDED.street, profiles.street),
            barangay = COALESCE(EXCLUDED.barangay, profiles.barangay),
            city = COALESCE(EXCLUDED.city, profiles.city),
            province = COALESCE(EXCLUDED.province, profiles.province),
            zip_code = COALESCE(EXCLUDED.zip_code, profiles.zip_code),
            contact_number = COALESCE(EXCLUDED.contact_number, profiles.contact_number),
            taxpayer_id = COALESCE(EXCLUDED.taxpayer_id, profiles.taxpayer_id),
            sss_number = COALESCE(EXCLUDED.sss_number, profiles.sss_number),
            philhealth_number = COALESCE(EXCLUDED.philhealth_number, profiles.philhealth_number),
            pagibig_number = COALESCE(EXCLUDED.pagibig_number, profiles.pagibig_number)
    """)

    try:
        await db.execute(query, params)
        await db.commit()
        return {"status": "success", "message": "Profile updated."}
    except Exception as e:
        await db.rollback()
        # Log the real DB error server-side; keep the client message clean
        # but non-empty so the user isn't left with a generic failure.
        raise HTTPException(status_code=500, detail=f"Database update failed: {str(e)}")