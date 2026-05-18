from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db_session
from app.schemas.profile import ProfileRead
from app.services.profile_service import get_or_create_profile

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("/me", response_model=ProfileRead)
async def read_current_profile(current_user=Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> ProfileRead:
    """Return the profile for the authenticated Supabase user. Create one if needed."""
    profile = await get_or_create_profile(session, current_user)
    # commit to persist any created/updated changes
    await session.commit()
    return profile
