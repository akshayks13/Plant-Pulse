import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from loguru import logger

from .config import DEV_SECRET_KEY, get_settings
from .database import init_db
from .routes import auth, diagnosis, admin, community

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not settings.debug and settings.secret_key == DEV_SECRET_KEY:
        raise RuntimeError("SECRET_KEY must be set when DEBUG is false (refusing to start with the dev key).")
    logger.info("Initializing database…")
    await init_db()
    # Seed admin user
    await _seed_admin()
    # Load the CNN models now so the first scan is fast (runs in a thread: it takes a few seconds)
    from fastapi.concurrency import run_in_threadpool
    from .services import ml_service
    logger.info("Loading CNN models…")
    await run_in_threadpool(ml_service.load_all_models)
    logger.info("Plant-Pulse API ready 🌿")
    yield
    logger.info("Shutting down.")


async def _seed_admin():
    """Create the admin user if it does not exist (credentials come from ADMIN_EMAIL / ADMIN_PASSWORD)."""
    import secrets as _secrets

    from .database import AsyncSessionLocal
    from .models import User
    from sqlalchemy import select
    from .services.auth import hash_password

    email = settings.admin_email
    password = settings.admin_password
    generated = False
    if not password:
        if settings.debug:
            password = "admin123"          # local development only
        else:
            password = _secrets.token_urlsafe(12)
            generated = True

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == email))
        if not result.scalar_one_or_none():
            admin = User(
                email=email,
                full_name="Plant-Pulse Admin",
                hashed_password=hash_password(password),
                role="ADMIN",
            )
            db.add(admin)
            await db.commit()
            if generated:
                logger.warning(f"ADMIN_PASSWORD not set: generated one-time admin password for {email}: {password}")
            else:
                logger.info(f"Admin user created: {email}")


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
app.include_router(community.router)

# Static file serving for uploads
upload_dir = os.path.abspath(settings.upload_dir)
os.makedirs(upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")


@app.get("/health")
async def health():
    """Liveness plus the state of the two pipeline stages behind /diagnosis/predict."""
    from .services import ml_service, retrieval_client

    retrieval = await retrieval_client.health()
    return {
        "status": "healthy",
        "service": settings.app_name,
        "cnn": {
            "device": str(ml_service.DEVICE),
            "model_dir": settings.model_dir,
            "models": ml_service.list_models(),
        },
        "retrieval": retrieval,
    }


@app.get("/")
async def root():
    return {"message": "Plant-Pulse API 🌿", "docs": "/docs"}
