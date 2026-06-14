from __future__ import annotations

import json
import logging
import sys

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    # ── Application ────────────────────────────────────────────────────────────
    project_name: str = "Resume Analyser API"
    api_v1_prefix: str = "/api/v1"
    environment: str = Field(default="development")
    debug: bool = Field(default=False)

    # ── Database ───────────────────────────────────────────────────────────────
    # Required — must be postgresql+asyncpg:// for async SQLAlchemy
    database_url: str = Field(..., alias="DATABASE_URL")

    # ── Supabase ───────────────────────────────────────────────────────────────
    # SUPABASE_JWT_SECRET is required for JWT verification
    supabase_url: str = Field(default="", alias="SUPABASE_URL")
    supabase_jwt_secret: str = Field(..., alias="SUPABASE_JWT_SECRET")
    supabase_jwt_audience: str = Field(default="authenticated", alias="SUPABASE_JWT_AUDIENCE")
    supabase_jwt_issuer: str | None = Field(default=None, alias="SUPABASE_JWT_ISSUER")

    # ── Supabase Storage ───────────────────────────────────────────────────────
    # Service role key — NEVER expose to frontend. Backend + Render only.
    # Find: Supabase Dashboard → Settings → API → service_role key
    supabase_service_role_key: str = Field(default="", alias="SUPABASE_SERVICE_ROLE_KEY")
    # Bucket names — only "resumes" used today; voice/reports reserved for future
    supabase_storage_bucket: str = Field(default="resumes", alias="SUPABASE_STORAGE_BUCKET")

    # ── AI provider ────────────────────────────────────────────────────────────
    ai_provider: str = Field(default="groq", alias="AI_PROVIDER")
    groq_api_key: str = Field(default="", alias="GROQ_API_KEY")
    groq_model: str = Field(default="llama-3.3-70b-versatile", alias="GROQ_MODEL")

    # ── CORS ───────────────────────────────────────────────────────────────
    # Stored as a raw string so pydantic-settings does NOT attempt json.loads()
    # on a complex type before our own parsing logic runs.
    #
    # Accepted formats for the CORS_ORIGINS env var:
    #   Comma-separated : https://myapp.vercel.app,http://localhost:3000
    #   JSON array      : ["https://myapp.vercel.app","http://localhost:3000"]
    cors_origins_raw: str = Field(
        default="http://localhost:3000",
        alias="CORS_ORIGINS",
    )

    @computed_field  # type: ignore[misc]
    @property
    def cors_origins(self) -> list[str]:
        """Parse CORS_ORIGINS into a list, accepting comma-separated or JSON array."""
        raw = (self.cors_origins_raw or "").strip()
        if not raw:
            return ["http://localhost:3000"]
        # Support JSON array format: ["https://app.vercel.app","http://localhost:3000"]
        if raw.startswith("["):
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    return [str(o).strip() for o in parsed if str(o).strip()]
            except json.JSONDecodeError:
                pass
        # Default: comma-separated plain string
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

    def validate_for_production(self) -> None:
        """
        Called at startup to catch missing production secrets early.
        Raises SystemExit so Render/deployment platforms report a failed start.
        """
        if self.environment != "production":
            return

        errors: list[str] = []

        if not self.supabase_jwt_secret:
            errors.append("SUPABASE_JWT_SECRET is required in production.")

        if not self.groq_api_key:
            errors.append("GROQ_API_KEY is required in production.")

        if not self.database_url or self.database_url == "postgresql+asyncpg://user:password@host/db":
            errors.append("DATABASE_URL must be set to a real database in production.")

        # Storage: warn if service role key missing (storage uploads will silently skip)
        if not self.supabase_service_role_key:
            errors.append(
                "SUPABASE_SERVICE_ROLE_KEY is required in production for resume file storage. "
                "Find it: Supabase Dashboard → Settings → API → service_role."
            )

        only_localhost = all("localhost" in o or "127.0.0.1" in o for o in self.cors_origins)
        if only_localhost:
            errors.append(
                "CORS_ORIGINS only contains localhost. "
                "Add your Vercel domain, e.g.: CORS_ORIGINS=https://myapp.vercel.app,http://localhost:3000"
            )

        if errors:
            logger = logging.getLogger(__name__)
            for error in errors:
                logger.critical("Production config error: %s", error)
            sys.exit(1)


def _build_settings() -> Settings:
    s = Settings()
    s.validate_for_production()
    return s


# Single settings instance shared across the app.
# Using a plain module-level singleton (not lru_cache) so validate_for_production
# runs exactly once at import time without memoisation side effects.
settings = _build_settings()
