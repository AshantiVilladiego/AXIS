import logging
from functools import lru_cache
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

logger = logging.getLogger(__name__)

_bearer_scheme = HTTPBearer(auto_error=False)


@lru_cache(maxsize=1)
def _get_jwk_client() -> jwt.PyJWKClient:
    """
    Lazily builds the JWKS client on first use rather than at import time.

    Building it as a bare module-level statement means a missing/malformed
    SUPABASE_URL crashes the ENTIRE app on startup with an opaque
    'Invalid JWKS URI scheme' traceback, on every route, not just this one.
    Building it lazily -- and only once, thanks to lru_cache -- means a
    misconfiguration instead surfaces as a clear 500 on the one endpoint
    that needs auth, and the rest of the app still boots and serves normally.
    """
    supabase_url = str(settings.supabase_url or "").strip().rstrip("/")
    if not supabase_url.startswith(("http://", "https://")):
        raise RuntimeError(
            f"SUPABASE_URL is missing or malformed in settings (got {supabase_url!r}). "
            "Set SUPABASE_URL in your .env to your project's URL, e.g. "
            "https://<project-ref>.supabase.co, and confirm app/core/config.py "
            "actually declares and reads a `supabase_url` field."
        )
    jwks_url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
    return jwt.PyJWKClient(jwks_url)


async def get_current_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)],
) -> str | None:
    """
    Derives the caller's user id from a verified Supabase access token —
    never from a client-supplied form/body field, which anyone could spoof.

    Behavior:
      - Valid 'Authorization: Bearer <token>' -> returns the verified user id.
      - Invalid/expired token -> 401.
      - No token at all:
          - environment == "development" -> returns None (caller falls back
            to DEFAULT_DEV_USER_ID, e.g. in DocumentService._resolve_user_id).
          - any other environment -> 401. No anonymous uploads in prod/staging.
    """
    if credentials is None:
        if settings.environment == "development":
            return None
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token. Include 'Authorization: Bearer <supabase_access_token>'.",
        )

    try:
        jwk_client = _get_jwk_client()
        signing_key = jwk_client.get_signing_key_from_jwt(credentials.credentials)
        payload = jwt.decode(
            credentials.credentials,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
        )
    except RuntimeError as exc:
        # Raised by _get_jwk_client() above when SUPABASE_URL is bad.
        logger.error(str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server auth is misconfigured.",
        ) from exc
    except jwt.PyJWKClientError as exc:
        logger.error("Could not resolve Supabase signing key: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not verify session token (signing key lookup failed).",
        ) from exc
    except jwt.PyJWTError as exc:
        logger.warning("JWT verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token.",
        ) from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token did not contain a subject (user id).",
        )

    return user_id