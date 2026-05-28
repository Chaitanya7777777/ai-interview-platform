from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.profile import Profile
from app.schemas.auth import SupabaseUser


async def get_profile_by_auth_user_id(session: AsyncSession, auth_user_id: UUID) -> Optional[Profile]:
    stmt = select(Profile).where(Profile.auth_user_id == auth_user_id)
    result = await session.execute(stmt)
    return result.scalars().first()


async def create_profile(session: AsyncSession, auth_user_id: UUID, email: str | None = None, full_name: str | None = None, avatar_url: str | None = None) -> Profile:
    profile = Profile(auth_user_id=auth_user_id, email=email, full_name=full_name, avatar_url=avatar_url)
    session.add(profile)
    await session.flush()
    return profile


async def get_or_create_profile(session: AsyncSession, supabase_user: SupabaseUser) -> Profile:
    # Try to find existing profile by auth_user_id
    existing = await get_profile_by_auth_user_id(session, supabase_user.user_id)
    if existing:
        # Optionally update basic fields if changed
        updated = False
        if supabase_user.email and existing.email != str(supabase_user.email):
            existing.email = str(supabase_user.email)
            updated = True
        if supabase_user.user_metadata.get("full_name") and existing.full_name != supabase_user.user_metadata.get("full_name"):
            existing.full_name = supabase_user.user_metadata.get("full_name")
            updated = True
        if supabase_user.user_metadata.get("avatar_url") and existing.avatar_url != supabase_user.user_metadata.get("avatar_url"):
            existing.avatar_url = supabase_user.user_metadata.get("avatar_url")
            updated = True

        if updated:
            await session.flush()

        return existing

    # Create new profile
    email = str(supabase_user.email) if supabase_user.email else None
    full_name = supabase_user.user_metadata.get("full_name") if isinstance(supabase_user.user_metadata, dict) else None
    avatar_url = supabase_user.user_metadata.get("avatar_url") if isinstance(supabase_user.user_metadata, dict) else None

    profile = await create_profile(session, supabase_user.user_id, email=email, full_name=full_name, avatar_url=avatar_url)
    return profile


async def update_profile(
    session: AsyncSession,
    profile_id,
    *,
    full_name: str | None = None,
    avatar_url: str | None = None,
) -> Profile:
    """Apply partial updates to an existing Profile row and flush."""
    from sqlalchemy import select
    stmt = select(Profile).where(Profile.id == profile_id)
    result = await session.execute(stmt)
    profile = result.scalars().first()
    if not profile:
        raise ValueError(f"Profile {profile_id} not found.")
    if full_name is not None:
        profile.full_name = full_name
    if avatar_url is not None:
        profile.avatar_url = avatar_url
    await session.flush()
    return profile

