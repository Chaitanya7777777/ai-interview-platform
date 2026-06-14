"""
resume_service.py
-----------------
Business-logic layer for resume upload, text extraction, AI analysis,
and DB persistence orchestration.

Upload flow (with storage)
--------------------------
1.  Validate extension + MIME type
2.  Read bytes + validate size
3.  Write to temp file → parse text → delete temp file
    (any error here: abort — nothing uploaded yet)
4.  Upload original bytes to Supabase Storage → get storage_path
    (any error here: raise HTTP 503 — nothing in DB yet)
5.  Create DB record with file_url = storage_path
    (any error here: delete from Storage → raise)
6.  Optionally run AI analysis + persist result
7.  Return ResumeUploadResponse

Rollback guarantees
-------------------
- Parse failure        → no Storage write, no DB write
- Storage upload fail  → raise (no DB write)
- DB persist fail      → delete from Storage, then raise
- AI failure           → DB record kept (resume still saved), raise
"""

from __future__ import annotations

import asyncio
import logging
import tempfile
from pathlib import Path
from uuid import UUID

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.resume import ResumeUploadResponse
from app.utils.parsers.docx_parser import extract_text_from_docx
from app.utils.parsers.pdf_parser import extract_text_from_pdf

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

MAX_FILE_SIZE_BYTES: int = 5 * 1024 * 1024  # 5 MB

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
    """Return the lowercased extension if allowed; raise HTTP 415 otherwise."""
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
    """Raise HTTP 415 if the MIME type is not on the allow-list for this extension."""
    if not content_type:
        return

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
    """Read all bytes; raise HTTP 413 if the file exceeds MAX_FILE_SIZE_BYTES."""
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
    profile_id: UUID,
    session: AsyncSession,
    analyse: bool = False,
) -> ResumeUploadResponse:
    """
    Full pipeline: validate → parse → upload → persist → (optionally analyse) → return.

    Storage upload happens AFTER parsing succeeds — no orphan files for invalid uploads.

    Parameters
    ----------
    file        : FastAPI UploadFile from the multipart form field
    profile_id  : UUID of the authenticated user's Profile row (for DB link)
    session     : async DB session; caller is responsible for commit/rollback
    analyse     : when True, calls the AI service after text extraction

    Returns
    -------
    ResumeUploadResponse — always contains resume_id, extracted text, and metadata.
    When analyse=True also contains analysis_result (and analysis_warning if needed).

    Raises
    ------
    HTTPException(415) : unsupported file extension or MIME type
    HTTPException(413) : file > 5 MB
    HTTPException(422) : file is empty or cannot be parsed
    HTTPException(503) : Storage upload failed or AI service error/timeout
    HTTPException(500) : AI API key not configured
    """
    # Lazy imports — keeps startup fast and avoids circular dependencies
    from app.services.resume_db_service import create_resume_record, save_analysis_result  # noqa: PLC0415
    from app.services.storage_service import build_storage_path, delete_file, upload_file  # noqa: PLC0415

    filename: str = file.filename or "uploaded_file"

    # ── Step 1: Validate extension + MIME ─────────────────────────────────────
    extension = _validate_extension(filename)
    _validate_mime_type(file.content_type, extension)

    # ── Step 2: Read + validate size ──────────────────────────────────────────
    raw_bytes = await _read_and_validate_size(file)
    file_size = len(raw_bytes)

    # ── Step 3: Parse locally (temp file) ─────────────────────────────────────
    # Storage upload only happens if this succeeds — no orphan objects for bad files.
    tmp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=extension) as tmp:
            tmp.write(raw_bytes)
            tmp_path = Path(tmp.name)

        if extension == ".pdf":
            extracted_text = await extract_text_from_pdf(tmp_path)
        else:
            extracted_text = await extract_text_from_docx(tmp_path)

    finally:
        if tmp_path and tmp_path.exists():
            tmp_path.unlink(missing_ok=True)

    # ── Step 4: Upload to Supabase Storage ────────────────────────────────────
    storage_path = build_storage_path(profile_id, extension)
    try:
        storage_path = await upload_file(
            storage_path,
            raw_bytes,
            file.content_type or "application/octet-stream",
        )
    except RuntimeError as exc:
        logger.error("Storage upload failed for profile %s: %s", profile_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    # ── Step 5: Persist to DB ─────────────────────────────────────────────────
    # On failure: delete the already-uploaded storage object before re-raising.
    try:
        resume = await create_resume_record(
            session,
            profile_id=profile_id,
            file_name=filename,
            file_size_bytes=file_size,
            parsed_text=extracted_text,
            content_type=file.content_type or "application/octet-stream",
            file_url=storage_path,
        )
    except Exception as exc:
        logger.error(
            "DB persist failed after storage upload — rolling back storage object %s: %s",
            storage_path, exc,
        )
        try:
            await delete_file(storage_path)
        except RuntimeError:
            logger.error("Storage rollback also failed for %s — manual cleanup needed", storage_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save resume record. The upload has been rolled back.",
        ) from exc

    # ── Step 6: Optionally run AI analysis ────────────────────────────────────
    analysis_result = None
    analysis_warning = None

    if analyse:
        from app.services.ai_service import ai_service  # noqa: PLC0415

        try:
            analysis_result, is_fallback = await ai_service.analyze_resume(extracted_text)

            if is_fallback:
                analysis_warning = (
                    "AI analysis encountered an issue and returned a partial result. "
                    "The extracted text is accurate — only the analysis may be incomplete."
                )

            # Persist even the fallback so history always has a result row
            await save_analysis_result(session, resume, analysis_result)

        except asyncio.TimeoutError:
            logger.error("AI service timed out for resume '%s' (id=%s).", filename, resume.id)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "The AI analysis service timed out. "
                    "Your resume was saved. Please retry analysis later."
                ),
            )

        except RuntimeError as exc:
            logger.error("AI service runtime error: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(exc),
            )

        except Exception as exc:
            logger.error(
                "Unexpected AI service error for resume '%s': %s",
                filename, exc, exc_info=True,
            )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "The AI analysis service encountered an error. "
                    "Your resume was saved. Please retry analysis later."
                ),
            )

    # ── Step 7: Return response ───────────────────────────────────────────────
    return ResumeUploadResponse(
        resume_id=resume.id,
        filename=filename,
        content_type=file.content_type or "application/octet-stream",
        file_size_bytes=file_size,
        text_length=len(extracted_text),
        extracted_text=extracted_text,
        analysis_result=analysis_result,
        analysis_warning=analysis_warning,
    )
