"""
dashboard.py  (route)
---------------------
FastAPI router for dashboard analytics endpoints.

Endpoints
---------
GET /api/v1/dashboard/analytics
    Return aggregated analytics for the authenticated user's resumes.

Dependency injection
--------------------
get_current_user    → verifies Supabase JWT, returns SupabaseUser
get_db_session      → provides an async SQLAlchemy session
get_or_create_profile (via service) → resolves profile_id from auth user

Architecture
------------
Route → dashboard_service.get_dashboard_analytics() → DashboardAnalyticsResponse
DB logic lives entirely in dashboard_service.py, not here.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db_session
from app.schemas.auth import SupabaseUser
from app.schemas.dashboard import DashboardAnalyticsResponse
from app.services.dashboard_service import get_dashboard_analytics
from app.services.profile_service import get_or_create_profile

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get(
    "/analytics",
    response_model=DashboardAnalyticsResponse,
    summary="Get resume analytics for the authenticated user",
    description=(
        "Returns aggregated analytics derived from the user's analysed resumes: "
        "total uploads, average / best ATS score, score timeline, "
        "most common missing skills, and most recommended roles. "
        "Resumes without completed AI analysis are excluded from computed metrics."
    ),
)
async def get_analytics(
    current_user: SupabaseUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> DashboardAnalyticsResponse:
    """
    Protected analytics endpoint.

    1. Resolve (or create) the user's Profile row from their JWT.
    2. Delegate aggregation to the dashboard service.
    3. Return the fully-typed analytics response.

    No writes occur here — no commit needed.
    """
    profile = await get_or_create_profile(session, current_user)
    return await get_dashboard_analytics(session, profile_id=profile.id)
