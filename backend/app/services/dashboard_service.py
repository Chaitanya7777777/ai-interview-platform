"""
dashboard_service.py
--------------------
Analytics aggregation service for GET /api/v1/dashboard/analytics.

Responsibilities
----------------
- Fetch all resumes for a given profile in a SINGLE async query.
- Aggregate analytics entirely in Python from the analysis_result JSONB.
- Never crash on missing, null, or malformed analysis_result data.
- Return a fully-typed DashboardAnalyticsResponse.

Design
------
- One DB round-trip (no N+1).
- Pure Python aggregation — avoids complex JSONB SQL that is hard to maintain.
- All JSONB access is guarded with isinstance() + .get() + try/except.
"""

from __future__ import annotations

import logging
from collections import Counter
from uuid import UUID

from sqlalchemy import asc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.resume import Resume
from app.schemas.dashboard import (
    DashboardAnalyticsResponse,
    MissingSkillCount,
    RecommendedRoleCount,
    ScoreTrendPoint,
)

logger = logging.getLogger(__name__)

# Maximum items returned for skill/role frequency lists
_TOP_N = 10


def _safe_score(analysis_result: object) -> int | None:
    """
    Extract overall_score from a raw analysis_result value.

    Returns None if the value is absent, not a dict, or not an integer in [0, 100].
    Never raises.
    """
    if not isinstance(analysis_result, dict):
        return None
    score = analysis_result.get("overall_score")
    if isinstance(score, int) and 0 <= score <= 100:
        return score
    return None


def _safe_string_list(analysis_result: object, key: str) -> list[str]:
    """
    Extract a list[str] field from analysis_result safely.

    Skips non-string elements; returns [] on any problem.
    """
    if not isinstance(analysis_result, dict):
        return []
    raw = analysis_result.get(key)
    if not isinstance(raw, list):
        return []
    return [item for item in raw if isinstance(item, str) and item.strip()]


async def get_dashboard_analytics(
    session: AsyncSession,
    *,
    profile_id: UUID,
) -> DashboardAnalyticsResponse:
    """
    Compute full analytics for a user's resume history.

    Parameters
    ----------
    session    : active async SQLAlchemy session
    profile_id : UUID of the authenticated user's Profile row

    Returns
    -------
    DashboardAnalyticsResponse — safe empty-state object when no data exists.
    """
    # Single query — fetch all resumes for this profile ordered by upload date
    stmt = (
        select(Resume)
        .where(Resume.profile_id == profile_id)
        .order_by(asc(Resume.created_at))
    )
    result = await session.execute(stmt)
    resumes: list[Resume] = list(result.scalars().all())

    total_resumes = len(resumes)

    # --- Aggregate only analysed resumes ---
    scores: list[int] = []
    score_trend: list[ScoreTrendPoint] = []
    missing_skills_counter: Counter[str] = Counter()
    recommended_roles_counter: Counter[str] = Counter()

    for resume in resumes:
        score = _safe_score(resume.analysis_result)
        if score is None:
            # Skip resumes without valid analysis
            continue

        scores.append(score)

        # Score trend — one point per analysed resume
        date_str = resume.created_at.strftime("%Y-%m-%d")
        score_trend.append(ScoreTrendPoint(date=date_str, score=score))

        # Accumulate missing skills frequency
        for skill in _safe_string_list(resume.analysis_result, "missing_skills"):
            missing_skills_counter[skill.strip()] += 1

        # Accumulate recommended roles frequency
        for role in _safe_string_list(resume.analysis_result, "recommended_roles"):
            recommended_roles_counter[role.strip()] += 1

    analysed_resumes = len(scores)

    average_score = round(sum(scores) / analysed_resumes, 1) if scores else 0.0
    best_score = max(scores) if scores else 0

    top_missing_skills = [
        MissingSkillCount(skill=skill, count=count)
        for skill, count in missing_skills_counter.most_common(_TOP_N)
    ]
    top_roles = [
        RecommendedRoleCount(role=role, count=count)
        for role, count in recommended_roles_counter.most_common(_TOP_N)
    ]

    logger.info(
        "Dashboard analytics for profile %s: total=%d analysed=%d avg=%.1f best=%d",
        profile_id,
        total_resumes,
        analysed_resumes,
        average_score,
        best_score,
    )

    return DashboardAnalyticsResponse(
        total_resumes=total_resumes,
        analysed_resumes=analysed_resumes,
        average_score=average_score,
        best_score=best_score,
        score_trend=score_trend,
        missing_skills=top_missing_skills,
        recommended_roles=top_roles,
    )
