from collections.abc import AsyncGenerator
import logging

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


DATABASE_URL = _build_async_database_url(settings.database_url)

engine = create_async_engine(
	DATABASE_URL,
	echo=settings.environment.lower() == "development",
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
