from collections.abc import AsyncGenerator
import logging
import os
import ssl

from sqlalchemy.engine import URL, make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

logger = logging.getLogger(__name__)


def _build_engine_setup() -> tuple[URL, dict]:
    """Build a validated connection URL + connect_args."""
    is_vercel = os.environ.get("VERCEL") == "1" or os.environ.get("NOW_REGION") is not None
    is_production = settings.environment.lower() == "production" or is_vercel

    raw = str(settings.database_url).strip()

    if raw.startswith("postgresql+asyncpg://"):
        normalized = raw
    elif raw.startswith("postgresql://"):
        normalized = raw.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif raw.startswith("postgres://"):
        normalized = raw.replace("postgres://", "postgresql+asyncpg://", 1)
    else:
        raise ValueError(f"DATABASE_URL has an unrecognized scheme: {raw!r}")

    try:
        url = _make_url_safely(normalized)
    except Exception as exc:
        raise ValueError(
            "DATABASE_URL is malformed and could not be parsed. "
            "Check that it has the form "
            "postgresql://<user>:<password>@<host>:<port>/<database> "
            f"Original error: {exc}"
        ) from exc

    if url.host in (None, "") or url.port is None:
        raise ValueError(
            f"DATABASE_URL parsed but host or port is missing "
            f"(host={url.host!r}, port={url.port!r})."
        )

    if is_production:
        return url, {"ssl": _build_ssl_context()}

    # Local development: same verified path by default. This bypass only
    # fires if the env var is set as a real shell variable (not just in
    # .env) AND we're not in production -- so it can never leak into prod.
    if os.environ.get("DB_SSL_DIAGNOSTIC_DISABLE") == "1":
        logger.warning(
            "DB_SSL_DIAGNOSTIC_DISABLE=1 is set -- Postgres connection is "
            "UNENCRYPTED. This should never be set outside local debugging."
        )
        return url, {"ssl": "disable"}

    return url, {"ssl": _build_ssl_context()}


def _build_ssl_context() -> ssl.SSLContext:
    """Builds a verified SSL context for connecting to Supabase Postgres.

    Tries the public CA bundle (certifi) first -- Supabase's pooler cert
    is signed by a publicly trusted CA in most projects, so this usually
    just works with zero extra config. Falls back to a project-specific
    CA (env var, then local file) only if certifi's bundle doesn't
    validate the connection, since some pooler configs use a
    Supabase-specific intermediate cert.
    """
    import certifi

    use_custom_ca = os.environ.get("SUPABASE_USE_CUSTOM_CA") == "1"

    if not use_custom_ca:
        ctx = ssl.create_default_context(cafile=certifi.where())
    else:
        ca_cert_pem = os.environ.get("SUPABASE_CA_CERT")

        if ca_cert_pem:
            ca_cert_pem = ca_cert_pem.replace("\\n", "\n")
            ctx = ssl.create_default_context(cadata=ca_cert_pem)
        else:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            project_root = os.path.dirname(os.path.dirname(current_dir))
            ca_file = settings.db_ssl_ca_file or os.path.join(
                project_root, "certs", "prod-ca-2021.crt"
            )

            if not os.path.isfile(ca_file):
                raise FileNotFoundError(
                    f"SUPABASE_USE_CUSTOM_CA=1 is set but no custom CA was found. "
                    f"Set SUPABASE_CA_CERT (PEM contents) or place a file at '{ca_file}'."
                )
            ctx = ssl.create_default_context(cafile=ca_file)

    # Compatibility fix for Supabase CA
    if hasattr(ssl, "VERIFY_X509_STRICT"):
        ctx.verify_flags &= ~ssl.VERIFY_X509_STRICT

    return ctx


def _make_url_safely(url_string: str) -> URL:
    """Thin wrapper around SQLAlchemy's URL parser so failures raise here,
    with full context, instead of surfacing as a bare ValueError from deep
    inside sqlalchemy/engine/url.py.
    """
    return make_url(url_string)


DATABASE_URL, CONNECT_ARGS = _build_engine_setup()

# --- THE PGBOUNCER FIX ---
# Supabase uses PgBouncer on the pooler, which crashes if asyncpg tries to
# cache statements. Disable statement caching in all environments.
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