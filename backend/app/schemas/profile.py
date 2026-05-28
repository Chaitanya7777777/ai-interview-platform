from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ProfileBase(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = None
    avatar_url: str | None = None


class ProfileCreate(ProfileBase):
    auth_user_id: UUID


class ProfileRead(ProfileBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    auth_user_id: UUID
    created_at: datetime
    updated_at: datetime


class ProfileUpdate(BaseModel):
    """Fields the user may update via PATCH /api/v1/profile/me.

    All fields are optional — only non-None values are applied.
    Email is read-only here (managed by Supabase Auth).
    """
    full_name: str | None = Field(default=None, max_length=255)
    avatar_url: str | None = Field(default=None, max_length=1024)
