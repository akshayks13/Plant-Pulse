import os
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    secret_key: str = "plant-pulse-dev-secret-change-in-prod"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    database_url: str = "sqlite+aiosqlite:///./plant_pulse.db"
    upload_dir: str = "./uploads"
    debug: bool = True
    cors_origins: str = "http://localhost:3000,http://localhost:3001"
    model_path: str = "./model/plant_disease_model.tflite"
    app_name: str = "Plant-Pulse API"

    # Treatment / RAG service (apps/retrieval). The backend forwards the CNN's
    # class label + confidence here and stores the assembled answer.
    retrieval_url: str = "http://localhost:8001"
    retrieval_timeout_seconds: float = 45.0

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        protected_namespaces = ()   # allow the "model_path" field name


@lru_cache()
def get_settings() -> Settings:
    return Settings()
