"""
resume.py  (schemas)
--------------------
Pydantic models for the resume upload and history features.

Schemas
-------
ResumeCreate         : input shape for DB insert (internal use)
ResumeHistoryItem    : one row in the history list (ORM → Pydantic)
ResumeHistoryPage    : paginated wrapper returned by GET /resume/history
ResumeUploadResponse : returned by POST /resume/upload
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.ai import ResumeAnalysisResponse


# ── Internal DB create schema ─────────────────────────────────────────────────

class ResumeCreate(BaseModel):
    """Input payload for inserting a Resume row (used internally)."""

    file_name: str
    file_url: str
    file_size_bytes: int | None = Field(default=None, ge=0)
    parsed_text: str | None = None


# ── History schemas ───────────────────────────────────────────────────────────

class ResumeHistoryItem(BaseModel):
    """
    Single resume record returned in the history list.

    Maps directly to a Resume ORM row via from_attributes=True.
    analysis_result is typed as ResumeAnalysisResponse so the frontend
    gets a fully-typed object, not a raw dict.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    profile_id: UUID
    file_name: str
    file_size_bytes: int | None
    status: str
    text_length: int | None = None          # derived from parsed_text length
    analysis_result: ResumeAnalysisResponse | None = None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def model_validate(cls, obj: object, **kwargs: object) -> "ResumeHistoryItem":  # type: ignore[override]
        """
        Override to compute text_length from parsed_text on the ORM row
        without exposing the full extracted text in the history list.
        """
        instance = super().model_validate(obj, **kwargs)

        # If obj is the ORM model, pull parsed_text for the length calculation
        if hasattr(obj, "parsed_text") and obj.parsed_text:
            instance.text_length = len(obj.parsed_text)

        return instance


class ResumeHistoryPage(BaseModel):
    """
    Paginated response wrapper for GET /api/v1/resume/history.

    Pagination fields follow the standard pattern used across the platform.
    """

    items: list[ResumeHistoryItem]
    total_count: int = Field(ge=0, description="Total resume records for this user")
    page: int = Field(ge=1, description="Current page number (1-based)")
    page_size: int = Field(ge=1, description="Records per page")
    total_pages: int = Field(ge=1, description="Total number of pages")
    has_next: bool
    has_prev: bool


# ── Upload response schema ────────────────────────────────────────────────────

class ResumeUploadResponse(BaseModel):
    """
    Returned by POST /api/v1/resume/upload.

    Fields
    ------
    resume_id         : UUID of the persisted Resume row
    filename          : original filename as uploaded by the client
    content_type      : MIME type (e.g. "application/pdf")
    file_size_bytes   : raw byte size of the received file
    text_length       : character count of the extracted text
    extracted_text    : full plain-text content parsed from the file
    analysis_result   : structured AI analysis (only when ?analyse=true)
    analysis_warning  : non-null when AI returned malformed JSON
    """

    resume_id: UUID
    filename: str
    content_type: str
    file_size_bytes: int
    text_length: int
    extracted_text: str
    analysis_result: ResumeAnalysisResponse | None = None
    analysis_warning: str | None = None
