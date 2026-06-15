"""
job_match_db_service.py
-----------------------
Database persistence layer for the Job Match Analyzer feature.

Responsibilities
----------------
- Expose find_dedup_match() for the service layer to check BEFORE uploading.
- Save/update job_match rows via upsert_job_match().
- Fetch paginated job match history (preview-only, no storage fetch).
- Return dashboard summary stats.
- Return a single row for the JD view endpoint.

Storage / dedup contract
------------------------
- find_dedup_match() is called BEFORE the JD is uploaded to storage.
- If a dedup hit is found, its existing job_description_path is reused
  (same jd_hash = same content = no re-upload needed).
- upsert_job_match() writes the path (new or reused) into the DB row.

Transaction contract
--------------------
All functions call session.flush() only. The calling route commits.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.job_match import JobMatch
from app.db.models.resume import Resume
from app.schemas.ai import JobMatchAnalysisResponse
from app.schemas.job_match import (
    JobMatchDashboardStats,
    JobMatchHistoryItem,
    JobMatchHistoryPage,
    JobMatchResponse,
)

logger = logging.getLogger(__name__)

_DEDUP_WINDOW_HOURS = 24


# ── Conversion helpers ────────────────────────────────────────────────────────

def _to_response(
    row: JobMatch,
    resume_filename: str,
    *,
    was_duplicate: bool = False,
    warning: str | None = None,
) -> JobMatchResponse:
    """Convert a JobMatch ORM row + resume filename into the API response schema."""
    return JobMatchResponse(
        id=row.id,
        resume_id=row.resume_id,
        resume_filename=resume_filename,
        match_score=row.match_score,
        ats_score=row.ats_score,
        strengths=row.strengths or [],
        missing_keywords=row.missing_keywords or [],
        missing_skills=row.missing_skills or [],
        recommendations=row.recommendations or [],
        role_fit=row.role_fit or "",
        interview_readiness=row.interview_readiness or "",
        summary=row.summary or "",
        job_title=row.job_title,
        company_name=row.company_name,
        job_description_preview=row.job_description_preview,
        has_stored_jd=bool(row.job_description_path),
        was_duplicate=was_duplicate,
        analysis_warning=warning,
        created_at=row.created_at,
    )


def _to_history_item(row: JobMatch, resume_filename: str) -> JobMatchHistoryItem:
    """Convert a JobMatch ORM row into the history list schema (no storage fetch)."""
    return JobMatchHistoryItem(
        id=row.id,
        resume_id=row.resume_id,
        resume_filename=resume_filename,
        match_score=row.match_score,
        ats_score=row.ats_score,
        role_fit=row.role_fit or "",
        summary=row.summary or "",
        job_title=row.job_title,
        company_name=row.company_name,
        job_description_preview=row.job_description_preview,
        has_stored_jd=bool(row.job_description_path),
        created_at=row.created_at,
    )


# ── Dedup read ────────────────────────────────────────────────────────────────

async def find_dedup_match(
    session: AsyncSession,
    *,
    resume_id: UUID,
    jd_hash: str,
    profile_id: UUID,
) -> JobMatch | None:
    """
    Look for an existing row with the same (resume_id, jd_hash) within 24 hours.

    Called BEFORE the JD is uploaded to storage so the service layer can
    decide whether to reuse the existing storage object.

    Returns
    -------
    Existing JobMatch row or None.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=_DEDUP_WINDOW_HOURS)
    stmt = select(JobMatch).where(
        JobMatch.resume_id == resume_id,
        JobMatch.jd_hash == jd_hash,
        JobMatch.profile_id == profile_id,
        JobMatch.created_at >= cutoff,
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


# ── Write operations ──────────────────────────────────────────────────────────

async def upsert_job_match(
    session: AsyncSession,
    *,
    profile_id: UUID,
    resume_id: UUID,
    resume_filename: str,
    jd_hash: str,
    job_description_path: str | None,
    job_description_preview: str | None,
    job_title: str | None,
    company_name: str | None,
    analysis: JobMatchAnalysisResponse,
    is_fallback: bool,
    existing: JobMatch | None = None,
) -> JobMatchResponse:
    """
    Persist a job match result.

    Parameters
    ----------
    existing : Pre-fetched dedup row (from find_dedup_match) or None.
               If provided, this row is updated in-place instead of inserting.

    Storage contract
    ----------------
    When existing is not None (dedup hit):
      - The existing job_description_path is kept AS-IS if the caller
        did not upload a new file (jd_hash matches = same content).
      - If job_description_path is provided, it overwrites (re-upload case).

    When existing is None:
      - A new row is inserted with all provided fields.
    """
    analysis_dict = analysis.model_dump()

    if existing is not None:
        # ── Update existing row ───────────────────────────────────────────────
        existing.match_score = analysis.match_score
        existing.ats_score = analysis.ats_score
        existing.strengths = analysis.strengths
        existing.missing_keywords = analysis.missing_keywords
        existing.missing_skills = analysis.missing_skills
        existing.recommendations = analysis.recommendations
        existing.role_fit = analysis.role_fit
        existing.interview_readiness = analysis.interview_readiness
        existing.summary = analysis.summary
        existing.analysis = analysis_dict
        existing.updated_at = datetime.now(timezone.utc)
        # Update storage fields only if new values provided
        if job_description_path is not None:
            existing.job_description_path = job_description_path
        if job_description_preview is not None:
            existing.job_description_preview = job_description_preview
        if job_title is not None:
            existing.job_title = job_title
        if company_name is not None:
            existing.company_name = company_name
        await session.flush()
        logger.info(
            "Updated existing job match %s for profile %s (dedup hit within 24h)",
            existing.id,
            profile_id,
        )
        warning = (
            "Analysis updated — a previous match for this resume and job description "
            "was found within 24 hours."
            if is_fallback
            else None
        )
        return _to_response(existing, resume_filename, was_duplicate=True, warning=warning)

    # ── Insert new row ────────────────────────────────────────────────────────
    row = JobMatch(
        profile_id=profile_id,
        resume_id=resume_id,
        job_description=None,               # new rows use Storage, not TEXT
        job_description_path=job_description_path,
        job_description_preview=job_description_preview,
        job_title=job_title,
        company_name=company_name,
        jd_hash=jd_hash,
        match_score=analysis.match_score,
        ats_score=analysis.ats_score,
        strengths=analysis.strengths,
        missing_keywords=analysis.missing_keywords,
        missing_skills=analysis.missing_skills,
        recommendations=analysis.recommendations,
        role_fit=analysis.role_fit,
        interview_readiness=analysis.interview_readiness,
        summary=analysis.summary,
        analysis=analysis_dict,
    )
    session.add(row)
    await session.flush()
    logger.info(
        "Saved new job match %s for profile %s (score=%d, path=%s)",
        row.id,
        profile_id,
        row.match_score,
        job_description_path or "none",
    )

    warning = "AI analysis result may be incomplete — please retry." if is_fallback else None
    return _to_response(row, resume_filename, was_duplicate=False, warning=warning)


# ── Read operations ───────────────────────────────────────────────────────────

async def get_job_match_history(
    session: AsyncSession,
    *,
    profile_id: UUID,
    page: int = 1,
    page_size: int = 10,
) -> JobMatchHistoryPage:
    """
    Return a paginated list of job match records for the given profile.

    Never fetches from Storage — history uses the DB preview column only.
    Results are ordered by created_at DESC (newest first).
    """
    offset = (page - 1) * page_size

    count_stmt = (
        select(func.count())
        .where(JobMatch.profile_id == profile_id)
        .select_from(JobMatch)
    )
    total_count: int = (await session.execute(count_stmt)).scalar_one()

    rows_stmt = (
        select(JobMatch, Resume.file_name)
        .join(Resume, JobMatch.resume_id == Resume.id)
        .where(JobMatch.profile_id == profile_id)
        .order_by(desc(JobMatch.created_at))
        .offset(offset)
        .limit(page_size)
    )
    result = await session.execute(rows_stmt)
    rows = result.all()

    total_pages = max(1, -(-total_count // page_size))

    items = [_to_history_item(row, filename) for row, filename in rows]

    return JobMatchHistoryPage(
        items=items,
        total_count=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )


async def get_job_match_dashboard_stats(
    session: AsyncSession,
    *,
    profile_id: UUID,
) -> JobMatchDashboardStats:
    """
    Compute compact dashboard stats for the Job Match section.
    Returns safe zero-state values when no matches exist.
    """
    agg_stmt = (
        select(
            func.count().label("total"),
            func.avg(JobMatch.match_score).label("avg_score"),
            func.max(JobMatch.match_score).label("best_score"),
        )
        .where(JobMatch.profile_id == profile_id)
        .select_from(JobMatch)
    )
    agg = (await session.execute(agg_stmt)).one()
    total: int = agg.total or 0
    avg_score: float = round(float(agg.avg_score or 0), 1)
    best_score: int = int(agg.best_score or 0)

    recent_stmt = (
        select(JobMatch, Resume.file_name)
        .join(Resume, JobMatch.resume_id == Resume.id)
        .where(JobMatch.profile_id == profile_id)
        .order_by(desc(JobMatch.created_at))
        .limit(3)
    )
    recent_rows = (await session.execute(recent_stmt)).all()
    recent = [_to_history_item(row, filename) for row, filename in recent_rows]

    return JobMatchDashboardStats(
        total_matches=total,
        average_match_score=avg_score,
        best_match_score=best_score,
        recent_matches=recent,
    )


async def get_job_match_for_view(
    session: AsyncSession,
    *,
    match_id: UUID,
    profile_id: UUID,
) -> JobMatch | None:
    """
    Fetch a single JobMatch row for the JD view endpoint.
    Ownership-verified (profile_id check).

    Returns None if not found or access denied.
    """
    stmt = select(JobMatch).where(
        JobMatch.id == match_id,
        JobMatch.profile_id == profile_id,
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()
