from pathlib import Path
import json
from typing import List, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    APP_NAME: str = "HyperLocal API"
    APP_DESCRIPTION: str = "Smart Local Services Finder with AI"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "development"
    BACKEND_PUBLIC_URL: str = "http://127.0.0.1:8001"

    DATABASE_URL: str = "postgresql://postgres:admin@localhost:5432/hyperlocal"
    SECRET_KEY: str = "change-me-in-env"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    CORS_ORIGINS: List[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    ADMIN_EMAILS: List[str] = Field(default_factory=lambda: ["admin@hyperlocal.dev"])

    ANTHROPIC_API_KEY: Optional[str] = None
    ANTHROPIC_MODEL: str = "claude-sonnet-4-20250514"
    ANTHROPIC_API_URL: str = "https://api.anthropic.com/v1/messages"
    ANTHROPIC_VERSION: str = "2023-06-01"
    GOOGLE_MAPS_API_KEY: Optional[str] = None
    GOOGLE_GEOCODING_API_URL: str = "https://maps.googleapis.com/maps/api/geocode/json"
    GOOGLE_PLACES_AUTOCOMPLETE_API_URL: str = "https://places.googleapis.com/v1/places:autocomplete"
    REDIS_URL: Optional[str] = "redis://localhost:6379"
    RAZORPAY_KEY_ID: Optional[str] = None
    RAZORPAY_KEY_SECRET: Optional[str] = None
    UPI_PAYMENT_ID: Optional[str] = None
    UPI_PAYMENT_NAME: Optional[str] = None
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: Optional[str] = None
    MAIL_FROM_NAME: Optional[str] = None
    SMTP_USE_TLS: bool = True
    EMAIL_OTP_EXPIRE_MINUTES: int = 10
    RATE_LIMIT_WINDOW_SECONDS: int = 60
    RATE_LIMIT_MAX_REQUESTS: int = 120
    MAX_UPLOAD_BYTES: int = 5 * 1024 * 1024
    ALLOWED_UPLOAD_EXTENSIONS: List[str] = Field(
        default_factory=lambda: [".jpg", ".jpeg", ".png", ".pdf", ".webp"]
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | List[str]) -> List[str]:
        if isinstance(value, str):
            value = value.strip()
            if not value:
                return []
            if value.startswith("["):
                parsed = json.loads(value)
                return [str(origin).strip() for origin in parsed if str(origin).strip()]
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("ADMIN_EMAILS", mode="before")
    @classmethod
    def parse_admin_emails(cls, value: str | List[str]) -> List[str]:
        if isinstance(value, str):
            value = value.strip()
            if not value:
                return []
            if value.startswith("["):
                parsed = json.loads(value)
                return [str(email).strip().lower() for email in parsed if str(email).strip()]
            return [email.strip().lower() for email in value.split(",") if email.strip()]
        return [str(email).strip().lower() for email in value if str(email).strip()]

    @field_validator("ALLOWED_UPLOAD_EXTENSIONS", mode="before")
    @classmethod
    def parse_allowed_upload_extensions(cls, value: str | List[str]) -> List[str]:
        if isinstance(value, str):
            value = value.strip()
            if not value:
                return []
            if value.startswith("["):
                parsed = json.loads(value)
                return [str(item).strip().lower() for item in parsed if str(item).strip()]
            return [item.strip().lower() for item in value.split(",") if item.strip()]
        return [str(item).strip().lower() for item in value if str(item).strip()]


settings = Settings()
