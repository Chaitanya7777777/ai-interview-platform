from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class InterviewCreate(BaseModel):
    title: str
    interview_type: str = Field(default="mock")
    resume_id: UUID | None = None


class InterviewRead(InterviewCreate):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    profile_id: UUID
    status: str
    overall_score: int | None = None
    summary: str | None = None
    ai_metadata: dict | None = None
    created_at: datetime
    updated_at: datetime


class InterviewMessageCreate(BaseModel):
    sender: str
    content: str
    message_metadata: dict | None = None


class InterviewMessageRead(InterviewMessageCreate):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    interview_id: UUID
    created_at: datetime
