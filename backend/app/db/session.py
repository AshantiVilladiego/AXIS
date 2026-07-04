from collections.abc import AsyncGenerator
import logging
import os
import ssl

from sqlalchemy.engine import URL, make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

logger = logging.getLogger(__name__)

# --- Fill these in from Supabase Dashboard -> Project Settings -> Database ---
# The project ref / username look correct already (postgres.atwdobxtgsmumswhrviu),
# but the ORIGINAL .env string had no real hostname: "...axisbyyearners@://supabase.com"
# That produces an empty host AND an empty port, which is exactly what triggered
# `int('')` deep inside sqlalchemy/engine/url.py.
#
# Get the real values (host will look like "aws-0-<region>.pooler.supabase.com"
# and port will be 5432 or 6543) and put them in your .env as DATABASE_URL, e.g.:
#
#   DATABASE_URL=postgresql://postgres.atwdobxtgsmumswhrviu:axisbyyearners@aws-0-us-east-1.pooler.supabase.com:6543/postgres
#
# ------------------------------------------------------------------------------


def _build_engine_setup() -> tuple[URL, dict]:
    """Build a validated connection URL + connect_args.

    Uses URL.create() instead of raw string concatenation so a malformed
    host/port can never silently collapse into an empty string that crashes
    deep inside SQLAlchemy's url parser.
    """
    is_vercel = os.environ.get("VERCEL") == "1" or os.environ.get("NOW_REGION") is not None

    raw = str(settings.database_url).strip()

    # Support both postgresql:// and postgres:// (Supabase sometimes hands out
    # the latter), and always target the asyncpg driver explicitly.
    if raw.startswith("postgresql+asyncpg://"):
        normalized = raw
    elif raw.startswith("postgresql://"):
        normalized = raw.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif raw.startswith("postgres://"):
        normalized = raw.replace("postgres://", "postgresql+asyncpg://", 1)
    else:
        raise ValueError(
            f"DATABASE_URL has an unrecognized scheme: {raw!r}. "
            "Expected it to start with postgresql://, postgres://, or postgresql+asyncpg://"
        )

    try:
        url = _make_url_safely(normalized)
    except Exception as exc:  # noqa: BLE001
        raise ValueError(
            "DATABASE_URL is malformed and could not be parsed. "
            "Check that it has the form "
            "postgresql://<user>:<password>@<host>:<port>/<database> "
            "with a real hostname and port (get this from the Supabase dashboard). "
            f"Original error: {exc}"
        ) from exc

    if url.host in (None, "") or url.port is None:
        raise ValueError(
            f"DATABASE_URL parsed but host or port is missing (host={url.host!r}, "
            f"port={url.port!r}). Your connection string is missing the real Supabase "
            "hostname/port segment -- copy the exact string from "
            "Supabase Dashboard -> Project Settings -> Database -> Connection string."
        )

    if is_vercel:
        # Production: always verify certs properly.
        connect_args = {"ssl": ssl.create_default_context()}
        return url, connect_args

    # Local development only: corporate proxy intercepts TLS with a self-signed
    # cert, so we relax verification. This branch is unreachable in prod because
    # of the VERCEL/NOW_REGION check above.
    #
    # TEMP DIAGNOSTIC: disabling TLS entirely to test whether the corporate
    # proxy is mangling the encrypted Postgres wire protocol post-handshake.
    # If db-check succeeds with this, that confirms the proxy (not your
    # credentials) was the problem. REVERT before doing anything sensitive
    # over this connection -- this sends the password and all data in the
    # clear on your local network.
    print("--- LOCAL DEVELOPMENT: SSL DISABLED (diagnostic) ---")
    return url, {"ssl": "disable"}


def _make_url_safely(url_string: str) -> URL:
    """Thin wrapper around SQLAlchemy's URL parser so failures raise here,
    with full context, instead of surfacing as a bare ValueError from deep
    inside sqlalchemy/engine/url.py.
    """
    return make_url(url_string)


DATABASE_URL, CONNECT_ARGS = _build_engine_setup()

# --- THE PGBOUNCER FIX ---
# Supabase uses PgBouncer on port 6543, which crashes if asyncpg tries to cache statements.
# Injecting this into your existing args safely disables caching in all environments.
CONNECT_ARGS["statement_cache_size"] = 0
# -------------------------

engine = create_async_engine(
    DATABASE_URL,
    echo=settings.environment.lower() == "development",
    connect_args=CONNECT_ARGS,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            logger.exception("Database session rolled back due to an unhandled error")
            raise