"""
job_match.py  (route)
---------------------
FastAPI router for the Job Match Analyzer feature.

Endpoints
---------
POST /api/v1/job-match
    Accepts a resume_id + job_description, runs AI analysis,
    persists the result (with 24-hour dedup), and returns the
    full structured match report.

GET  /api/v1/job-match/history
    Returns the authenticated user's paginated job match history.
    History items never load from Storage — they use the preview column.

GET  /api/v1/job-match/dashboard-stats
    Returns compact stats (total, average, best, recent 3) for
    the dashboard integration.

GET  /api/v1/job-match/{match_id}/job-description
    View the full job description for a specific match.
    For storage-backed rows: fetches text from Supabase Storage.
    For legacy rows (pre-0006): reads from job_description column.
    Returns { content, job_title, company_name, source }.

Dependency injection
--------------------
get_current_user → verifies Supabase JWT, returns SupabaseUser
get_db_session   → provides an async SQLAlchemy session

Transaction contract
--------------------
POST route calls session.commit() after the service completes.
GET routes are read-only — no commit needed.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db_session
from app.schemas.auth import SupabaseUser
from app.schemas.job_match import (
    JobDescriptionViewResponse,
    JobMatchDashboardStats,
    JobMatchHistoryPage,
    JobMatchRequest,
    JobMatchResponse,
)
from app.services.job_match_db_service import (
    get_job_match_dashboard_stats,
    get_job_match_for_view,
    get_job_match_history,
)
from app.services.job_match_service import run_job_match
from app.services.profile_service import get_or_create_profile
from app.services import storage_service

router = APIRouter(prefix="/job-match", tags=["job-match"])

MAX_PAGE_SIZE = 50


@router.post(
    "",
    response_model=JobMatchResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Analyse resume vs. job description",
    description=(
        "Provide an existing resume ID and a job description (300–10,000 chars). "
        "The backend loads the resume's parsed text, uploads the JD to private "
        "storage, calls the AI layer, and returns a structured match report. "
        "Results are persisted automatically. If the same resume and job description "
        "are submitted within 24 hours, the existing storage object is reused and "
        "the result is updated (not duplicated)."
    ),
)
async def create_job_match(
    body: JobMatchRequest,
    current_user: SupabaseUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> JobMatchResponse:
    """
    Protected job match analysis endpoint.

    1. Resolve (or create) the user's Profile row from their JWT.
    2. Run the full match analysis + storage upload via job_match_service.
    3. Commit the transaction.
    4. Return the result.
    """
    profile = await get_or_create_profile(session, current_user)

    result = await run_job_match(
        session,
        profile_id=profile.id,
        resume_id=body.resume_id,
        job_description=body.job_description,
    )

    await session.commit()
    return result


@router.get(
    "/history",
    response_model=JobMatchHistoryPage,
    summary="Get job match history",
    description=(
        "Return the authenticated user's paginated job match history, "
        "newest first. History items use the DB preview column — no Storage "
        "fetches occur. Each item includes job_title, company_name (when available), "
        "resume filename, match score, ATS score, and timestamp."
    ),
)
async def get_history(
    page: int = Query(default=1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(
        default=10,
        ge=1,
        le=MAX_PAGE_SIZE,
        description=f"Records per page (max {MAX_PAGE_SIZE})",
    ),
    current_user: SupabaseUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> JobMatchHistoryPage:
    profile = await get_or_create_profile(session, current_user)
    return await get_job_match_history(
        session,
        profile_id=profile.id,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/dashboard-stats",
    response_model=JobMatchDashboardStats,
    summary="Get job match dashboard stats",
    description=(
        "Returns compact aggregated stats for the dashboard integration: "
        "total matches, average match score, best match score, and the 3 most "
        "recent matches. Returns safe zero-state values when no matches exist."
    ),
)
async def get_dashboard_stats(
    current_user: SupabaseUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> JobMatchDashboardStats:
    profile = await get_or_create_profile(session, current_user)
    return await get_job_match_dashboard_stats(session, profile_id=profile.id)


@router.get(
    "/{match_id}/job-description",
    response_model=JobDescriptionViewResponse,
    summary="View full job description",
    description=(
        "Fetch the full job description text for a specific match. "
        "For new rows (post-0006): content is read from Supabase Storage. "
        "For legacy rows (pre-0006): content is read from the job_description column. "
        "Returns the text alongside extracted metadata (job_title, company_name)."
    ),
)
async def view_job_description(
    match_id: UUID,
    current_user: SupabaseUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> JobDescriptionViewResponse:
    """
    Protected JD view endpoint.

    1. Resolve the user's Profile.
    2. Fetch the job_match row with ownership check.
    3. If row has job_description_path → fetch text from Storage.
    4. If row has job_description (legacy) → return it directly.
    5. If neither → 404 with helpful message.
    """
    profile = await get_or_create_profile(session, current_user)

    match = await get_job_match_for_view(
        session,
        match_id=match_id,
        profile_id=profile.id,
    )

    if match is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job match not found or access denied.",
        )

    # ── Storage-backed row (post-0006) ────────────────────────────────────────
    if match.job_description_path:
        try:
            content = await storage_service.download_text(match.job_description_path)
        except RuntimeError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Could not retrieve job description from storage: {exc}",
            )
        return JobDescriptionViewResponse(
            content=content,
            job_title=match.job_title,
            company_name=match.company_name,
            source="storage",
        )

    # ── Legacy row (pre-0006) — read from job_description column ──────────────
    if match.job_description:
        return JobDescriptionViewResponse(
            content=match.job_description,
            job_title=match.job_title,
            company_name=match.company_name,
            source="legacy",
        )

    # ── Neither path set (should not occur in practice) ───────────────────────
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=(
            "The full job description is not available for this match. "
            "It may have been created before storage support was enabled."
        ),
    )
