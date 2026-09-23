from __future__ import annotations

import logging
import time as _time
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.api.router import api_router
from app.core.config import settings
from app.core.exceptions import AIServiceError, AIValidationError, InputTooLargeError
from app.core.logging_config import setup_logging
from app.core.middleware import RequestContextMiddleware, SecurityHeadersMiddleware
from app.core.rate_limit import limiter

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Run startup and shutdown logic."""
    setup_logging(level="DEBUG" if settings.debug else "INFO")
    app.state._start_time = _time.time()
    logger.info(
        "Starting %s [environment=%s]",
        settings.project_name,
        settings.environment,
    )
    yield
    logger.info("Shutting down %s", settings.project_name)


# Disable interactive docs in production — they expose your API schema publicly
_docs_url = "/docs" if settings.environment != "production" else None
_redoc_url = "/redoc" if settings.environment != "production" else None

app = FastAPI(
    title=settings.project_name,
    debug=settings.debug,
    docs_url=_docs_url,
    redoc_url=_redoc_url,
    lifespan=lifespan,
)

# ── Rate Limiter ──────────────────────────────────────────────────────────────
app.state.limiter = limiter

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID", "X-Idempotency-Key"],
    expose_headers=["X-Request-ID", "Server-Timing"],
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestContextMiddleware)

app.include_router(api_router, prefix=settings.api_v1_prefix)


# ── Global Exception Handlers ─────────────────────────────────────────────────


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "success": False,
            "message": "Rate limit exceeded. Please slow down.",
            "code": "RATE_LIMIT_EXCEEDED",
        },
    )


@app.exception_handler(InputTooLargeError)
async def input_too_large_handler(request: Request, exc: InputTooLargeError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "message": exc.message,
            "code": "INPUT_TOO_LARGE",
        },
    )


@app.exception_handler(AIServiceError)
async def ai_service_error_handler(request: Request, exc: AIServiceError) -> JSONResponse:
    logger.error("AIServiceError on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=503,
        content={
            "success": False,
            "message": exc.message,
            "code": "AI_SERVICE_ERROR",
        },
        headers={"Retry-After": "30"},
    )


@app.exception_handler(AIValidationError)
async def ai_validation_error_handler(request: Request, exc: AIValidationError) -> JSONResponse:
    logger.error("AIValidationError on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=502,
        content={
            "success": False,
            "message": exc.message,
            "code": "AI_VALIDATION_ERROR",
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all for unhandled exceptions — never leak tracebacks in production."""
    logger.error(
        "Unhandled exception on %s %s: %s",
        request.method,
        request.url.path,
        exc,
        exc_info=True,
    )
    if settings.environment == "production":
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "An unexpected error occurred. Please try again later.",
                "code": "INTERNAL_ERROR",
            },
        )
    # In development, re-raise so FastAPI shows the full traceback
    raise exc


@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    return {"message": f"{settings.project_name} is running.", "environment": settings.environment}


@app.get("/health", tags=["health"], summary="Health check")
async def health() -> dict[str, str]:
    """
    Health check endpoint used by Render and other deployment platforms.
    Returns HTTP 200 as long as the application process is alive.
    DB connectivity is NOT checked here — keep health checks fast.
    """
    return {"status": "ok", "environment": settings.environment}
