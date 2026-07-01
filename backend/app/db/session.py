from collections.abc import AsyncGenerator
import logging
import ssl

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.engine import make_url

from app.core.config import settings

logger = logging.getLogger(__name__)


def _build_async_database_url(database_url: str) -> str:
	"""Normalize a PostgreSQL URL for SQLAlchemy async engine usage."""
	url = make_url(database_url)

	if url.drivername == "postgresql":
		url = url.set(drivername="postgresql+asyncpg")
	elif url.drivername == "postgres":
		url = url.set(drivername="postgresql+asyncpg")

	return str(url)


def _build_connect_args(database_url: str) -> dict:
	"""Use SSL for hosted PostgreSQL providers like Supabase."""
	url = make_url(database_url)
	host = (url.host or "").lower()

	if not host:
		return {}

	if host in {"localhost", "127.0.0.1"} or host.endswith(".local"):
		return {}

	return {"ssl": ssl.create_default_context()}


DATABASE_URL = _build_async_database_url(settings.database_url)
CONNECT_ARGS = _build_connect_args(settings.database_url)

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
	"""
	FastAPI dependency that yields an async database session.

	The session is rolled back automatically if the request raises, and it is
	always closed when the dependency scope ends.
	"""
	async with AsyncSessionLocal() as session:
		try:
			yield session
		except Exception:
			await session.rollback()
			logger.exception("Database session rolled back due to an unhandled error")
			raise
