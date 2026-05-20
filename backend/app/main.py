from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.config import settings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:  # noqa: ARG001
    """Run startup and shutdown logic."""
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all for unhandled exceptions — never leak tracebacks in production."""
    logger.error("Unhandled exception on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    if settings.environment == "production":
        return JSONResponse(
            status_code=500,
            content={"detail": "An unexpected error occurred. Please try again later."},
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

