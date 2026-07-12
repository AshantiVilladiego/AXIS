from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "A.X.I.S. Backend Engine"
    environment: str = "development"

    database_url: str = Field(..., alias="DATABASE_URL")

    gemini_api_key: str | None = Field(default=None, alias="GEMINI_API_KEY")
    groq_api_key: str | None = Field(default=None, alias="GROQ_API_KEY")
    hf_api_key: str | None = Field(default=None, alias="HF_API_KEY")

    supabase_url: str | None = Field(default=None, alias="SUPABASE_URL")
    supabase_anon_key: str | None = Field(default=None, alias="SUPABASE_ANON_KEY")
    supabase_jwt_secret: str | None = None
    
    # Corrected: Defined once, mapping correctly to the env var
    supabase_service_role_key: str = Field(..., alias="SUPABASE_SERVICE_ROLE_KEY")

    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ],
        alias="CORS_ORIGINS",
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors_origins(cls, value):
        """Allow CORS_ORIGINS to be a plain comma-separated string in
        Vercel's env var UI (e.g. "https://a.com,https://b.com") instead
        of requiring JSON list syntax. Local dev origins are always kept
        so localhost never gets locked out by a production env var.
        """
        local_defaults = ["http://localhost:3000", "http://127.0.0.1:3000"]

        if value is None or value == "":
            return local_defaults

        if isinstance(value, str):
            parsed = [origin.strip() for origin in value.split(",") if origin.strip()]
        elif isinstance(value, list):
            parsed = value
        else:
            parsed = local_defaults

        # Always keep local origins available, dedup while preserving order
        combined = local_defaults + [o for o in parsed if o not in local_defaults]
        return combined

    # Placeholder user ID used ONLY when environment == "development"
    default_dev_user_id: str | None = Field(
        default=None, alias="DEFAULT_DEV_USER_ID"
    )

    # Path to a CA bundle for database TLS connections
    db_ssl_ca_file: str | None = Field(default=None, alias="SSL_CERT_FILE")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()