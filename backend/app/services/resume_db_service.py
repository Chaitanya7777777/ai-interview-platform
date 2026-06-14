"""
resume_db_service.py
--------------------
Database persistence layer for the Resume feature.

Responsibilities
----------------
- Save a new resume record (linked to a profile) after upload + parse.
- Update the resume record with AI analysis results.
- Fetch the authenticated user's resume history with pagination.

This service is the ONLY place that touches the Resume ORM model.
It is kept entirely separate from parsing (resume_service.py) and AI
(ai_service.py) so each layer can be tested and changed independently.

DB Relationships
----------------
  Profile (profiles)
    └── Resume (resumes)   ← profile_id FK → profiles.id  (CASCADE DELETE)

All functions accept an AsyncSession so the calling route controls the
transaction lifecycle (commit / rollback).
"""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.resume import Resume
from app.schemas.ai import ResumeAnalysisResponse
from app.schemas.resume import ResumeHistoryItem, ResumeHistoryPage

logger = logging.getLogger(__name__)


# ── Write operations ──────────────────────────────────────────────────────────

async def create_resume_record(
    session: AsyncSession,
    *,
    profile_id: UUID,
    file_name: str,
    file_size_bytes: int,
    parsed_text: str,
    content_type: str,
    file_url: str = "",
) -> Resume:
    """
    Insert a new Resume row linked to the given profile.

    The record is flushed (assigned an ID) but NOT committed — the route
    is responsible for committing the transaction after any subsequent
    updates (e.g. analysis result).

    Parameters
    ----------
    session         : active async SQLAlchemy session
    profile_id      : UUID of the owning Profile row
    file_name       : original filename from the upload
    file_size_bytes : byte length of the uploaded file
    parsed_text     : full plain-text extracted from the file
    content_type    : MIME type string (e.g. "application/pdf") — not stored
    file_url        : Supabase Storage object path (e.g. "resumes/abc/file.pdf")
                      Empty string for legacy rows or when storage is not configured.

    Returns
    -------
    Resume ORM instance with id assigned (not yet committed).
    """
    resume = Resume(
        profile_id=profile_id,
        file_name=file_name,
        file_url=file_url,
        file_size_bytes=file_size_bytes,
        parsed_text=parsed_text,
        status="parsed",
    )
    session.add(resume)
    await session.flush()  # gives the row its UUID without committing
    logger.info("Created resume record %s for profile %s (storage_path=%r)", resume.id, profile_id, file_url)
    return resume


async def save_analysis_result(
    session: AsyncSession,
    resume: Resume,
    analysis: ResumeAnalysisResponse,
) -> Resume:
    """
    Persist a completed AI analysis onto an existing Resume row.

    Stores the Pydantic model as a plain dict so it maps directly to
    PostgreSQL JSONB.  Updates status to "analysed".

    Parameters
    ----------
    session  : active async SQLAlchemy session (must contain ``resume``)
    resume   : Resume ORM instance (must already be attached to this session)
    analysis : validated ResumeAnalysisResponse from the AI service

    Returns
    -------
    The updated Resume instance.
    """
    resume.analysis_result = analysis.model_dump()
    resume.status = "analysed"
    await session.flush()
    logger.info("Saved analysis result for resume %s (score=%s)", resume.id, analysis.overall_score)
    return resume


# ── Read operations ───────────────────────────────────────────────────────────

async def get_resume_history(
    session: AsyncSession,
    *,
    profile_id: UUID,
    page: int = 1,
    page_size: int = 10,
) -> ResumeHistoryPage:
    """
    Return a paginated list of resume records for the given profile.

    Results are ordered by created_at DESC (newest first).
    The total_count enables the frontend to build pagination controls.

    Parameters
    ----------
    session     : active async SQLAlchemy session
    profile_id  : UUID of the authenticated user's Profile row
    page        : 1-based page number (default 1)
    page_size   : number of records per page (default 10, max enforced in route)

    Returns
    -------
    ResumeHistoryPage with items and pagination metadata.
    """
    offset = (page - 1) * page_size

    # Total count (for pagination metadata)
    count_stmt = select(func.count()).where(Resume.profile_id == profile_id).select_from(Resume)
    total_count: int = (await session.execute(count_stmt)).scalar_one()

    # Fetch the page
    rows_stmt = (
        select(Resume)
        .where(Resume.profile_id == profile_id)
        .order_by(desc(Resume.created_at))
        .offset(offset)
        .limit(page_size)
    )
    result = await session.execute(rows_stmt)
    resumes = list(result.scalars().all())

    total_pages = max(1, -(-total_count // page_size))  # ceiling division

    items = [ResumeHistoryItem.model_validate(r) for r in resumes]

    return ResumeHistoryPage(
        items=items,
        total_count=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )


# ── Delete operations ─────────────────────────────────────────────────────────

async def delete_resume(
    session: AsyncSession,
    *,
    resume_id: UUID,
    profile_id: UUID,
) -> None:
    """
    Delete a resume record and its associated Storage file.

    Order
    -----
    1. Verify ownership (fetch resume)
    2. Delete from Supabase Storage FIRST
       └ If storage delete fails: abort — do NOT touch the DB row
    3. Delete the DB row
    4. Flush

    This order prevents orphaned storage objects: if the DB delete fails
    after a storage delete, the file is already gone and the DB row can
    be retried or cleaned up later.

    Raises
    ------
    ValueError   : resume not found or belongs to a different profile
    RuntimeError : storage deletion failed (DB row is preserved)
    """
    from app.services.storage_service import delete_file  # noqa: PLC0415

    stmt = select(Resume).where(
        Resume.id == resume_id,
        Resume.profile_id == profile_id,
    )
    result = await session.execute(stmt)
    resume = result.scalar_one_or_none()

    if resume is None:
        raise ValueError(f"Resume {resume_id} not found or access denied.")

    # Step 2: Delete from Storage BEFORE touching the DB row
    if resume.file_url:
        try:
            await delete_file(resume.file_url)
        except RuntimeError as exc:
            # Storage delete failed — abort the entire operation
            logger.error(
                "Storage delete failed for resume %s (path=%s): %s — DB row preserved.",
                resume_id, resume.file_url, exc,
            )
            raise

    # Step 3: Delete the DB row
    await session.delete(resume)
    await session.flush()
    logger.info("Deleted resume %s for profile %s", resume_id, profile_id)
