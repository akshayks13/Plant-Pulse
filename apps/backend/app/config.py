from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings

# apps/backend/app/config.py -> parents[2] is apps/, where model_file/ lives
DEFAULT_MODEL_DIR = Path(__file__).resolve().parents[2] / "model_file"


DEV_SECRET_KEY = "plant-pulse-dev-secret-change-in-prod"


class Settings(BaseSettings):
    secret_key: str = DEV_SECRET_KEY

    # Seeded admin account. Leave ADMIN_PASSWORD unset only in local dev (DEBUG=true).
    admin_email: str = "admin@plant-pulse.ai"
    admin_password: str = ""
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    database_url: str = "sqlite+aiosqlite:///./plant_pulse.db"
    upload_dir: str = "./uploads"
    debug: bool = True
    cors_origins: str = "http://localhost:3000,http://localhost:3001"
    app_name: str = "Plant-Pulse API"

    # Folder with the trained PyTorch checkpoints (*.pth) used by ml_service.py
    model_dir: str = str(DEFAULT_MODEL_DIR)

    # Treatment / RAG service (apps/retrieval). The backend forwards the CNN's
    # class label + confidence here and stores the assembled answer.
    retrieval_url: str = "http://localhost:8001"
    retrieval_timeout_seconds: float = 45.0

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        protected_namespaces = ()   # allow field names that start with "model_"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
