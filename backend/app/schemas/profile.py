from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr


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
