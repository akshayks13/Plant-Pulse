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


# Columns added after the first release. create_all() only creates missing
# tables, so existing SQLite files get these through ALTER TABLE.
_SQLITE_MIGRATIONS: dict[str, dict[str, str]] = {
    "users": {
        "otp_code": "VARCHAR",
        "otp_created_at": "DATETIME",
    },
    "diagnoses": {
        "model_source": "VARCHAR",
        "runner_up_label": "VARCHAR",
        "runner_up_confidence": "FLOAT",
        "top_predictions": "TEXT",
        "result_type": "VARCHAR",
        "retrieval_status": "VARCHAR DEFAULT 'pending'",
        "retrieval_note": "TEXT",
        "retrieval_result": "TEXT",
        "retrieval_at": "DATETIME",
        "confirmed_disease_id": "VARCHAR",
    },
}


async def _migrate_sqlite():
    """Add missing columns to existing SQLite tables."""
    if "sqlite" not in settings.database_url:
        return
    async with engine.begin() as conn:
        for table, columns in _SQLITE_MIGRATIONS.items():
            result = await conn.execute(text(f"PRAGMA table_info({table})"))
            existing = {row[1] for row in result.fetchall()}
            for name, ddl in columns.items():
                if name not in existing:
                    await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _migrate_sqlite()


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
