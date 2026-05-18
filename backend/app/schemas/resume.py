from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ResumeCreate(BaseModel):
    file_name: str
    file_url: str
    file_size_bytes: int | None = Field(default=None, ge=0)
    parsed_text: str | None = None


class ResumeRead(ResumeCreate):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    profile_id: UUID
    analysis_result: dict | None = None
    status: str
    created_at: datetime
    updated_at: datetime
