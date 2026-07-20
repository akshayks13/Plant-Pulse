import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from loguru import logger

from .config import get_settings
from .database import init_db
from .routes import auth, diagnosis, admin

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database…")
    await init_db()
    # Seed admin user
    await _seed_admin()
    logger.info("Plant-Pulse API ready 🌿")
    yield
    logger.info("Shutting down.")


async def _seed_admin():
    """Create default admin if not exists."""
    from .database import AsyncSessionLocal
    from .models import User
    from sqlalchemy import select
    from .services.auth import hash_password

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == "admin@plant-pulse.ai"))
        if not result.scalar_one_or_none():
            admin = User(
                email="admin@plant-pulse.ai",
                full_name="Plant-Pulse Admin",
                hashed_password=hash_password("admin123"),
                role="ADMIN",
            )
            db.add(admin)
            await db.commit()
            logger.info("Default admin created: admin@plant-pulse.ai / admin123")


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Plant disease detection API",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
app.include_router(diagnosis.router)
app.include_router(admin.router)

# Static file serving for uploads
upload_dir = os.path.abspath(settings.upload_dir)
os.makedirs(upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")


@app.get("/health")
async def health():
    return {"status": "healthy", "service": settings.app_name}


@app.get("/")
async def root():
    return {"message": "Plant-Pulse API 🌿", "docs": "/docs"}
