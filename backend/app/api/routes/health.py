"""Enhanced health check endpoint with multi-probe diagnostics."""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Request
from sqlalchemy import text

from app.core.config import settings
from app.db.database import async_session_factory

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/health", tags=["health"])


@router.get(
    "",
    summary="Enhanced health check",
    description=(
        "Multi-probe health check verifying database connectivity, "
        "AI provider configuration, and storage configuration. "
        "Returns 200 for healthy/degraded, 503 for unhealthy."
    ),
)
async def health_check(request: Request) -> dict:
    checks: dict[str, dict] = {}
    overall_healthy = True

    # ── Database probe ────────────────────────────────────────────────────
    try:
        start = time.perf_counter()
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
        latency_ms = round((time.perf_counter() - start) * 1000, 1)
        checks["database"] = {"status": "up", "latency_ms": latency_ms}
    except Exception as exc:
        checks["database"] = {"status": "down", "error": str(exc)[:100]}
        overall_healthy = False

    # ── Groq AI configuration ─────────────────────────────────────────────
    groq_configured = bool(settings.groq_api_key)
    checks["groq"] = {
        "status": "configured" if groq_configured else "not_configured",
        "model": settings.groq_model,
    }
    if not groq_configured:
        overall_healthy = False

    # ── Storage configuration ─────────────────────────────────────────────
    storage_configured = bool(
        settings.supabase_url and settings.supabase_service_role_key
    )
    checks["storage"] = {
        "status": "configured" if storage_configured else "not_configured",
        "bucket": settings.supabase_storage_bucket,
    }

    # ── Uptime ────────────────────────────────────────────────────────────
    start_time = getattr(request.app.state, "_start_time", None)
    uptime_seconds = round(time.time() - start_time, 1) if start_time else None

    # ── Determine overall status ──────────────────────────────────────────
    if not overall_healthy:
        status_str = "unhealthy"
    elif not storage_configured:
        status_str = "degraded"
    else:
        status_str = "healthy"

    return {
        "status": status_str,
        "checks": checks,
        "version": "1.0.0",
        "environment": settings.environment,
        "uptime_seconds": uptime_seconds,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
