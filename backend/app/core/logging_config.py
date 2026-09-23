"""Structured JSON logging configuration for InterviewAI.

Call setup_logging() once at application startup (in main.py lifespan).
All modules should use logging.getLogger(__name__).

Never log: JWT tokens, passwords, resume text, job descriptions, answers.
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone


class JSONFormatter(logging.Formatter):
    """Emit each log record as a single-line JSON object."""

    def format(self, record: logging.LogRecord) -> str:
        log_obj: dict = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        # Merge extra fields (request_id, user_id, etc.)
        for key in ("request_id", "user_id", "method", "path", "status",
                    "latency_ms", "prompt_version", "retry_count", "ai_duration_ms"):
            val = getattr(record, key, None)
            if val is not None:
                log_obj[key] = val

        if record.exc_info and record.exc_info[1]:
            log_obj["exception"] = (
                f"{type(record.exc_info[1]).__name__}: {record.exc_info[1]}"
            )
        return json.dumps(log_obj, default=str)


def setup_logging(*, level: str = "INFO") -> None:
    """Configure the root logger with JSON output to stdout."""
    root = logging.getLogger()
    root.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Clear any pre-existing handlers (e.g. from uvicorn defaults)
    root.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())
    root.addHandler(handler)

    # Reduce noise from third-party libraries
    for noisy in ("httpx", "httpcore", "sqlalchemy.engine", "hpack", "asyncio"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
