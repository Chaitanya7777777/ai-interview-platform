"""
resume.py  (schemas)
--------------------
Pydantic models for the resume upload feature.

UploadResponse is the shape returned by POST /api/v1/resume/upload.
The existing ResumeCreate / ResumeRead models are kept intact for
future DB persistence work.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.ai import ResumeAnalysisResponse


# ── Existing persistence schemas (kept for future DB work) ────────────────────

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


# ── Upload response schema ────────────────────────────────────────────────────

class ResumeUploadResponse(BaseModel):
    """
    Returned by POST /api/v1/resume/upload.

    Fields
    ------
    filename          : original filename as uploaded by the client
    content_type      : MIME type detected from the upload (e.g. application/pdf)
    file_size_bytes   : raw byte size of the received file
    text_length       : character count of the extracted text
    extracted_text    : the full plain-text content parsed from the file
    analysis_result   : structured AI analysis (only present when ?analyse=true)
    analysis_warning  : non-null when AI returned malformed JSON and a fallback
                        was used — callers should surface this to the user
    """

    filename: str
    content_type: str
    file_size_bytes: int
    text_length: int
    extracted_text: str
    analysis_result: ResumeAnalysisResponse | None = None
    analysis_warning: str | None = None
