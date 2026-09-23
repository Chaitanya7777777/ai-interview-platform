"""Custom exception hierarchy for InterviewAI.

Keep exceptions domain-specific. HTTP status mapping lives in main.py
exception handlers — never import FastAPI here.
"""

from __future__ import annotations


class AIServiceError(Exception):
    """Groq API call failed (transient or permanent)."""

    def __init__(
        self,
        message: str = "AI service is temporarily unavailable.",
        *,
        retryable: bool = True,
    ) -> None:
        self.message = message
        self.retryable = retryable
        super().__init__(message)


class AIValidationError(Exception):
    """AI returned a response that failed schema validation after retries."""

    def __init__(self, message: str = "AI returned an invalid response.") -> None:
        self.message = message
        super().__init__(message)


class InputTooLargeError(Exception):
    """User input exceeds allowed size limits."""

    def __init__(self, field: str, actual: int, maximum: int) -> None:
        self.field = field
        self.actual = actual
        self.maximum = maximum
        self.message = (
            f"Field '{field}' exceeds maximum length "
            f"({actual:,} > {maximum:,} characters)."
        )
        super().__init__(self.message)
