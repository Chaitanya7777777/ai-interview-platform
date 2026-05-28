"""
profile.py  (routes)
---------------------
GET  /api/v1/profile/me        — fetch current user's profile
PATCH /api/v1/profile/me       — update full_name / avatar_url
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db_session
from app.schemas.auth import SupabaseUser
from app.schemas.profile import ProfileRead, ProfileUpdate
from app.services.profile_service import get_or_create_profile, update_profile

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("/me", response_model=ProfileRead)
async def read_current_profile(
    current_user: SupabaseUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ProfileRead:
    """Return the profile for the authenticated Supabase user. Create one if needed."""
    profile = await get_or_create_profile(session, current_user)
    await session.commit()
    return profile


@router.patch("/me", response_model=ProfileRead)
async def update_current_profile(
    body: ProfileUpdate,
    current_user: SupabaseUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ProfileRead:
    """Update full_name and/or avatar_url for the authenticated user."""
    profile = await get_or_create_profile(session, current_user)

    # Only apply non-None fields from the request body
    changed = False
    if body.full_name is not None:
        profile.full_name = body.full_name.strip() or None
        changed = True
    if body.avatar_url is not None:
        profile.avatar_url = body.avatar_url.strip() or None
        changed = True

    if not changed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No updatable fields provided.",
        )

    await session.flush()
    await session.commit()
    await session.refresh(profile)
    return profile
