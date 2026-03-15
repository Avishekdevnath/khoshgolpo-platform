from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

from pydantic import ValidationInfo, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "KhoshGolpo API"
    api_version: str = "0.1.0"
    environment: Literal["development", "staging", "production"] = "development"

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "khoshgolpo"
    cors_origins: list[str] = ["http://127.0.0.1:3000", "http://localhost:3000"]

    openai_api_key: str | None = None
    ai_model: str = "gpt-4o-mini"
    ai_warning_threshold: float = 0.6
    ai_flag_threshold: float = 0.8
    feed_v2_enabled: bool = True
    feed_ai_enabled: bool = True

    auth_mode: Literal["jwt", "static"] = "jwt"
    jwt_secret_key: str = "change-me-in-env"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    remember_me_access_token_expire_minutes: int = 60 * 24 * 30

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parents[2] / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        enable_decoding=False,
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Any) -> Any:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator("jwt_secret_key", mode="after")
    @classmethod
    def validate_jwt_secret(cls, value: str, info: ValidationInfo) -> str:
        auth_mode = info.data.get("auth_mode", "jwt")
        if auth_mode == "static":
            return value
        if value == "change-me-in-env":
            raise ValueError("jwt_secret_key must be changed from default in .env file")
        if len(value) < 32:
            raise ValueError("jwt_secret_key must be at least 32 characters long")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
