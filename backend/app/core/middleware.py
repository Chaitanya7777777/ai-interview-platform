"""Request lifecycle middleware for InterviewAI.

Provides:
- RequestContextMiddleware : UUID request IDs, Server-Timing header, request logging
- SecurityHeadersMiddleware : standard security response headers
- Context vars for cross-cutting timing instrumentation
"""

from __future__ import annotations

import logging
import time
import uuid
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)

# ── Context variables ─────────────────────────────────────────────────────────
# Accessible from any async code in the same request context.

request_id_var: ContextVar[str] = ContextVar("request_id", default="")
timing_var: ContextVar[dict[str, float]] = ContextVar("timing", default={})


def get_request_id() -> str:
    """Return the current request's ID (empty string outside a request)."""
    return request_id_var.get()


def record_timing(key: str, duration_ms: float) -> None:
    """Record a named timing measurement for the current request.

    Timings are emitted in the Server-Timing response header.
    Example keys: 'db', 'ai', 'storage'
    """
    ctx = timing_var.get()
    ctx[key] = round(duration_ms, 1)


# ── Request Context Middleware ────────────────────────────────────────────────


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Generate request IDs, measure latency, emit Server-Timing header."""

    async def dispatch(self, request: Request, call_next) -> Response:  # type: ignore[override]
        # Prefer client-supplied ID (for distributed tracing), else generate one
        rid = request.headers.get("X-Request-ID") or uuid.uuid4().hex
        request_id_var.set(rid)
        timing_var.set({})
        request.state.request_id = rid

        start = time.perf_counter()
        response: Response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000

        # ── Response headers ──────────────────────────────────────────────
        response.headers["X-Request-ID"] = rid

        # Server-Timing (visible in browser DevTools Network tab)
        timings = timing_var.get()
        timings["total"] = round(elapsed_ms, 1)
        parts = [f"{k};dur={v}" for k, v in timings.items()]
        response.headers["Server-Timing"] = ", ".join(parts)

        # ── Structured request log ────────────────────────────────────────
        user_id = getattr(request.state, "user_id", None)
        logger.info(
            "request_completed",
            extra={
                "request_id": rid,
                "user_id": str(user_id) if user_id else None,
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "latency_ms": round(elapsed_ms, 1),
            },
        )
        return response


# ── Security Headers Middleware ───────────────────────────────────────────────


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Append standard security headers to every response."""

    async def dispatch(self, request: Request, call_next) -> Response:  # type: ignore[override]
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=()"
        )
        return response
