from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from .config import get_settings
from .models import Base

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {},
)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def _migrate_sqlite():
    """Add missing columns to existing SQLite tables."""
    if "sqlite" not in settings.database_url:
        return
    async with engine.begin() as conn:
        result = await conn.execute(text("PRAGMA table_info(users)"))
        cols = {row[1] for row in result.fetchall()}
        if "otp_code" not in cols:
            await conn.execute(text("ALTER TABLE users ADD COLUMN otp_code VARCHAR"))
        if "otp_created_at" not in cols:
            await conn.execute(text("ALTER TABLE users ADD COLUMN otp_created_at DATETIME"))


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _migrate_sqlite()


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
