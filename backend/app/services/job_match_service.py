"""
job_match_service.py
--------------------
Orchestration layer for the Job Match Analyzer feature.

Flow (post-0006 storage upgrade)
---------------------------------
1. Fetch resume — verify ownership and parsed_text.
2. Normalize JD and compute SHA-256 hash for dedup.
3. Extract metadata (job_title, company_name) via heuristic.
4. Build 300-char preview.
5. Dedup check FIRST (before any storage write).
   a. If hit (same resume + jd_hash within 24h):
      - Reuse existing.job_description_path (same content → same file).
      - Set new_upload = False.
   b. If no hit:
      - Upload JD text to Supabase Storage.
      - Set new_upload = True, jd_path = uploaded path.
6. Call AI service.
7. If AI fails AND new_upload is True:
   - Delete the uploaded file from storage (cleanup orphan).
   - Re-raise the error.
8. Upsert DB row (passing existing row if dedup hit).
9. Return JobMatchResponse.

Transaction contract
--------------------
This service calls session.flush() only (via the DB service).
The calling route is responsible for session.commit().
On AI failure, no DB flush has happened yet — the session is clean.

Rollback guarantees
-------------------
- Storage upload fails  → abort immediately, no DB write, no orphan.
- AI fails, new upload  → delete uploaded file, abort, no DB write.
- AI fails, reuse path  → no storage change, abort, no DB write.
- DB flush fails        → session rolled back by route, orphaned storage
                          file is left (same accepted pattern as resumes).
"""

from __future__ import annotations

import hashlib
import logging
import re
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.resume import Resume
from app.schemas.job_match import JobMatchResponse
from app.services.ai_service import ai_service
from app.services.job_match_db_service import find_dedup_match, upsert_job_match
from app.services import storage_service
from app.utils.jd_metadata import extract_job_metadata

logger = logging.getLogger(__name__)

_PREVIEW_MAX = 300


# ── Helpers ───────────────────────────────────────────────────────────────────

def _normalize_jd(text: str) -> str:
    """
    Normalize whitespace for consistent hashing.
    Same content with different spacing/line-endings always produces
    the same hash → correct dedup across copy-paste variations.
    """
    return re.sub(r"\s+", " ", text).strip()


def _build_preview(text: str) -> str:
    """Return first _PREVIEW_MAX characters, trimmed at a word boundary if possible."""
    if len(text) <= _PREVIEW_MAX:
        return text.strip()
    truncated = text[:_PREVIEW_MAX]
    last_space = truncated.rfind(" ")
    if last_space > _PREVIEW_MAX - 30:
        truncated = truncated[:last_space]
    return truncated.strip() + "…"


# ── Main orchestrator ─────────────────────────────────────────────────────────

async def run_job_match(
    session: AsyncSession,
    *,
    profile_id: UUID,
    resume_id: UUID,
    job_description: str,
) -> JobMatchResponse:
    """
    Orchestrate a full job match analysis for one resume + job description.

    See module docstring for the complete flow and rollback guarantees.

    Raises
    ------
    HTTPException 404 : Resume not found or access denied.
    HTTPException 400 : Resume has no parsed text.
    HTTPException 503 : Storage upload failed or AI service error.
    HTTPException 500 : Unexpected error.
    """
    # ── Step 1: fetch and verify resume ownership ─────────────────────────────
    stmt = select(Resume).where(
        Resume.id == resume_id,
        Resume.profile_id == profile_id,
    )
    result = await session.execute(stmt)
    resume = result.scalar_one_or_none()

    if resume is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found or access denied.",
        )

    if not resume.parsed_text or not resume.parsed_text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "This resume has no extracted text. "
                "Please re-upload the resume before running a job match."
            ),
        )

    # ── Step 2: normalize + hash ──────────────────────────────────────────────
    normalized = _normalize_jd(job_description)
    jd_hash = hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    # ── Step 3: extract metadata ──────────────────────────────────────────────
    meta = extract_job_metadata(job_description)
    job_title = meta.get("job_title")
    company_name = meta.get("company_name")

    # ── Step 4: build preview ─────────────────────────────────────────────────
    preview = _build_preview(job_description)

    # ── Step 5: dedup check BEFORE storage write ──────────────────────────────
    existing = await find_dedup_match(
        session,
        resume_id=resume_id,
        jd_hash=jd_hash,
        profile_id=profile_id,
    )

    new_upload = False
    jd_path: str | None = None

    if existing is not None and existing.job_description_path:
        # Reuse existing storage object — same hash = same content
        jd_path = existing.job_description_path
        logger.info(
            "Dedup hit for profile %s — reusing storage path %s",
            profile_id,
            jd_path,
        )
    else:
        # ── Step 5b: upload JD to Storage ─────────────────────────────────────
        object_path = storage_service.build_jd_storage_path(profile_id)
        try:
            jd_path = await storage_service.upload_text(object_path, job_description)
            new_upload = True
            logger.info("Uploaded JD to storage: %s", jd_path)
        except RuntimeError as exc:
            logger.error("JD storage upload failed for profile %s: %s", profile_id, exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(exc),
            )

    # ── Step 6: call AI ───────────────────────────────────────────────────────
    try:
        analysis, is_fallback = await ai_service.analyze_job_match(
            resume_text=resume.parsed_text,
            job_description=job_description,
        )
    except Exception as exc:
        # ── Step 7: clean up storage on AI failure (new uploads only) ─────────
        if new_upload and jd_path:
            try:
                await storage_service.delete_file(jd_path)
                logger.info("Cleaned up orphaned JD file after AI failure: %s", jd_path)
            except Exception as del_exc:  # noqa: BLE001
                logger.warning("Failed to clean up JD file %s: %s", jd_path, del_exc)

        if isinstance(exc, TimeoutError):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="The AI service timed out. Please try again in a moment.",
            )
        if isinstance(exc, RuntimeError):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(exc),
            )
        logger.error("Unexpected error during job match AI call: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during analysis. Please try again.",
        )

    # ── Step 8: upsert DB row ─────────────────────────────────────────────────
    return await upsert_job_match(
        session,
        profile_id=profile_id,
        resume_id=resume_id,
        resume_filename=resume.file_name,
        jd_hash=jd_hash,
        job_description_path=jd_path,
        job_description_preview=preview,
        job_title=job_title,
        company_name=company_name,
        analysis=analysis,
        is_fallback=is_fallback,
        existing=existing,
    )
