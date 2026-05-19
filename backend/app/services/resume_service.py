"""
resume_service.py
-----------------
Business-logic layer for resume upload, text extraction, and AI analysis.

Responsibilities
----------------
1. Validate file extension and MIME type.
2. Validate file size (max 5 MB by default).
3. Save the upload to a temp file on disk.
4. Dispatch to the correct parser (PDF or DOCX).
5. Delete the temp file — even when an error occurs.
6. Optionally call AIService.analyze_resume() when the caller requests it.
7. Return a ResumeUploadResponse ready for the route to return.

Flow (without analysis)
-----------------------
route → validate_and_parse_resume(analyse=False) → parser → response

Flow (with analysis)
--------------------
route → validate_and_parse_resume(analyse=True) → parser → ai_service.analyze_resume() → response
"""

from __future__ import annotations

import asyncio
import logging
import tempfile
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.schemas.resume import ResumeUploadResponse
from app.utils.parsers.docx_parser import extract_text_from_docx
from app.utils.parsers.pdf_parser import extract_text_from_pdf

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

# Maximum allowed file size: 5 MB
MAX_FILE_SIZE_BYTES: int = 5 * 1024 * 1024

# Map from lowercase file extension → allowed MIME types
ALLOWED_EXTENSIONS: dict[str, set[str]] = {
    ".pdf": {"application/pdf"},
    ".docx": {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "application/octet-stream",
    },
}


# ── Internal helpers ──────────────────────────────────────────────────────────

def _validate_extension(filename: str) -> str:
    """
    Return the lowercased file extension if it is allowed.
    Raises HTTP 415 Unsupported Media Type otherwise.
    """
    extension = Path(filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"File extension '{extension}' is not supported. "
                "Only .pdf and .docx files are accepted."
            ),
        )

    return extension


def _validate_mime_type(content_type: str | None, extension: str) -> None:
    """
    Check that the browser-reported MIME type is consistent with the extension.
    Raises HTTP 415 if the MIME type is not in the allow-list for that extension.
    """
    if not content_type:
        return  # no content-type header → skip MIME check

    mime = content_type.split(";")[0].strip().lower()
    allowed_mimes = ALLOWED_EXTENSIONS[extension]

    if mime not in allowed_mimes:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"MIME type '{mime}' is not allowed for a '{extension}' file. "
                f"Expected one of: {', '.join(sorted(allowed_mimes))}."
            ),
        )


async def _read_and_validate_size(file: UploadFile) -> bytes:
    """
    Read the entire file into memory and enforce the size limit.
    Raises HTTP 413 Request Entity Too Large if the file exceeds MAX_FILE_SIZE_BYTES.
    """
    raw: bytes = await file.read()

    if len(raw) > MAX_FILE_SIZE_BYTES:
        size_mb = len(raw) / (1024 * 1024)
        limit_mb = MAX_FILE_SIZE_BYTES / (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"File size {size_mb:.2f} MB exceeds the maximum allowed "
                f"size of {limit_mb:.0f} MB."
            ),
        )

    return raw


# ── Public service function ───────────────────────────────────────────────────

async def validate_and_parse_resume(
    file: UploadFile,
    *,
    analyse: bool = False,
) -> ResumeUploadResponse:
    """
    Full pipeline: validate → save temp → extract text → (optionally analyse) → clean up → return.

    Parameters
    ----------
    file    : FastAPI UploadFile from the multipart form field
    analyse : When True, calls AIService.analyze_resume() after extraction.
              Defaults to False so existing callers are unaffected.

    Returns
    -------
    ResumeUploadResponse
        Always contains filename, content_type, file_size_bytes, text_length,
        extracted_text.  When analyse=True, also contains analysis_result and
        optionally analysis_warning.

    Raises
    ------
    HTTPException(415) : unsupported file extension or MIME type
    HTTPException(413) : file exceeds 5 MB
    HTTPException(422) : file is empty or cannot be parsed
    HTTPException(503) : Gemini timed out (only when analyse=True)
    HTTPException(500) : Gemini API key not configured (only when analyse=True)
    """
    filename: str = file.filename or "uploaded_file"

    # 1. Validate file extension
    extension = _validate_extension(filename)

    # 2. Validate MIME type
    _validate_mime_type(file.content_type, extension)

    # 3. Read file bytes and validate size
    raw_bytes = await _read_and_validate_size(file)
    file_size = len(raw_bytes)

    # 4. Write to a secure temp file on disk (deleted in the finally block)
    tmp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=extension) as tmp:
            tmp.write(raw_bytes)
            tmp_path = Path(tmp.name)

        # 5. Dispatch to the correct parser
        if extension == ".pdf":
            extracted_text = await extract_text_from_pdf(tmp_path)
        else:  # .docx
            extracted_text = await extract_text_from_docx(tmp_path)

    finally:
        # 6. Always clean up the temp file, even on error
        if tmp_path and tmp_path.exists():
            tmp_path.unlink(missing_ok=True)

    # 7. Optionally run AI analysis
    analysis_result = None
    analysis_warning = None

    if analyse:
        # Lazy import to avoid circular deps and keep startup fast when
        # the Gemini key is not yet configured.
        from app.services.ai_service import ai_service  # noqa: PLC0415

        try:
            analysis_result, is_fallback = await ai_service.analyze_resume(extracted_text)

            if is_fallback:
                analysis_warning = (
                    "AI analysis encountered an issue and returned a partial result. "
                    "The extracted text is accurate — only the analysis may be incomplete."
                )

        except asyncio.TimeoutError:
            logger.error("AI service timed out during resume analysis for file '%s'.", filename)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "The AI analysis service timed out. "
                    "Your resume text was extracted successfully. "
                    "Please try again in a moment."
                ),
            )

        except RuntimeError as exc:
            # GROQ_API_KEY not configured or empty response
            logger.error("AI service runtime error: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(exc),
            )

        except Exception as exc:
            # Catch any other exceptions from Groq or the AI service
            logger.error("Unexpected AI service error during resume analysis: %s", exc, exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "The AI analysis service encountered an error. "
                    "Your resume text was extracted successfully. "
                    "Please try again later."
                ),
            )

    # 8. Build and return the response
    return ResumeUploadResponse(
        filename=filename,
        content_type=file.content_type or "application/octet-stream",
        file_size_bytes=file_size,
        text_length=len(extracted_text),
        extracted_text=extracted_text,
        analysis_result=analysis_result,
        analysis_warning=analysis_warning,
    )
