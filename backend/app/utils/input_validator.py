"""Centralized input validation and sanitization for InterviewAI.

All user-facing text fields should pass through sanitize_text() before
processing. This module handles:
- Unicode NFC normalization
- Null byte and control character removal
- Whitespace trimming
- Size limit enforcement (raises InputTooLargeError, never silently truncates)
- Empty-string rejection

Usage:
    from app.utils.input_validator import sanitize_text, MAX_RESUME_TEXT

    cleaned = sanitize_text(raw_text, max_length=MAX_RESUME_TEXT, field_name="resume_text")
"""

from __future__ import annotations

import re
import unicodedata

from app.core.exceptions import InputTooLargeError

# ── Size limits (characters) ─────────────────────────────────────────────────

MAX_RESUME_TEXT: int = 50_000
MAX_JOB_DESCRIPTION: int = 10_000
MAX_INTERVIEW_ANSWER: int = 5_000
MAX_QUESTION_TEXT: int = 2_000
MAX_JOB_TITLE: int = 200

# Control characters (U+0000–U+001F except tab/newline/CR, plus U+007F–U+009F)
_CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]")


def sanitize_text(
    text: str,
    *,
    max_length: int,
    field_name: str,
) -> str:
    """Validate and sanitize a user-supplied text field.

    Parameters
    ----------
    text        : Raw user input.
    max_length  : Maximum allowed character count after sanitization.
    field_name  : Human-readable field name for error messages.

    Returns
    -------
    Sanitized string (NFC-normalized, trimmed, control chars removed).

    Raises
    ------
    ValueError         : Input is not a string or is empty after sanitization.
    InputTooLargeError : Input exceeds max_length after sanitization.
    """
    if not isinstance(text, str):
        raise ValueError(f"Field '{field_name}' must be a string.")

    # Unicode NFC normalization (canonical composition)
    text = unicodedata.normalize("NFC", text)

    # Remove null bytes and control characters
    text = _CONTROL_CHARS_RE.sub("", text)

    # Trim leading/trailing whitespace
    text = text.strip()

    # Reject empty strings
    if not text:
        raise ValueError(f"Field '{field_name}' must not be empty after sanitization.")

    # Enforce size limit — never silently truncate
    if len(text) > max_length:
        raise InputTooLargeError(
            field=field_name,
            actual=len(text),
            maximum=max_length,
        )

    return text
