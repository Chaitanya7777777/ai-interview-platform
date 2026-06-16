"""
job_match.py  (schemas)
-----------------------
Pydantic models for the Job Match Analyzer feature.

Schemas
-------
JobMatchRequest          : POST /api/v1/job-match  request body
JobMatchResponse         : POST /api/v1/job-match  response (full result)
JobMatchHistoryItem      : one row in GET /api/v1/job-match/history
JobMatchHistoryPage      : paginated wrapper for history
JobMatchDashboardStats   : compact stats for the dashboard
JobDescriptionViewResponse : GET /api/v1/job-match/{id}/job-description
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ── Request ───────────────────────────────────────────────────────────────────

class JobMatchRequest(BaseModel):
    """
    Request body for POST /api/v1/job-match.

    resume_id       : UUID of an existing resume owned by the calling user.
    job_description : Raw job description text — 300 to 10,000 characters.
    """

    resume_id: UUID
    job_description: str = Field(
        min_length=300,
        max_length=10_000,
        description="Job description text (300–10,000 characters)",
    )


# ── Full result response ──────────────────────────────────────────────────────

class JobMatchResponse(BaseModel):
    """
    Returned by POST /api/v1/job-match.

    Contains the persisted row ID, resume metadata, storage metadata,
    and the full structured AI analysis result.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    resume_id: UUID
    resume_filename: str            # file_name from the joined resume row
    match_score: int                # 0-100
    ats_score: int                  # 0-100
    strengths: list[str]
    missing_keywords: list[str]
    missing_skills: list[str]
    recommendations: list[str]
    role_fit: str
    interview_readiness: str
    summary: str

    # Storage metadata (None for pre-0006 rows)
    job_title: str | None = None
    company_name: str | None = None
    job_description_preview: str | None = None
    has_stored_jd: bool = False     # True when job_description_path is set

    was_duplicate: bool = False     # True when an existing row was reused
    analysis_warning: str | None = None  # non-null when AI returned fallback
    created_at: datetime


class JobMatchDetailResponse(BaseModel):
    """
    Richer detail payload for a job match view.
    Does not reuse history DTO and provides complete report metrics.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    resume_id: UUID
    resume_filename: str
    match_score: int
    ats_score: int
    job_title: str | None = None
    company_name: str | None = None
    created_at: datetime
    summary: str
    strengths: list[str]
    missing_keywords: list[str]
    missing_skills: list[str]
    recommendations: list[str]
    role_fit: str
    interview_readiness: str
    job_description_preview: str | None = None


# ── History schemas ───────────────────────────────────────────────────────────


class JobMatchHistoryItem(BaseModel):
    """
    Single job match record returned in the history list.

    The full job_description text is never loaded for history.
    Storage-backed rows expose job_title, company_name, and a 300-char preview.
    Old rows (pre-0006) show resume_filename and summary as fallback.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    resume_id: UUID
    resume_filename: str            # file_name from the joined resume row
    match_score: int
    ats_score: int
    role_fit: str
    summary: str

    # Storage metadata — None for pre-0006 rows
    job_title: str | None = None
    company_name: str | None = None
    job_description_preview: str | None = None
    has_stored_jd: bool = False

    created_at: datetime


class JobMatchHistoryPage(BaseModel):
    """
    Paginated response wrapper for GET /api/v1/job-match/history.
    Follows the exact same pagination contract as ResumeHistoryPage.
    """

    items: list[JobMatchHistoryItem]
    total_count: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    total_pages: int = Field(ge=1)
    has_next: bool
    has_prev: bool


# ── Dashboard summary ─────────────────────────────────────────────────────────

class JobMatchDashboardStats(BaseModel):
    """
    Compact stats block for the Dashboard page.
    Derived from all job_matches rows for a given profile.
    """

    total_matches: int = Field(ge=0)
    average_match_score: float = Field(ge=0, le=100)
    best_match_score: int = Field(ge=0, le=100)
    recent_matches: list[JobMatchHistoryItem] = Field(
        default_factory=list,
        description="Last 3 matches, newest first",
    )


# ── JD view response ──────────────────────────────────────────────────────────

class JobDescriptionViewResponse(BaseModel):
    """
    Returned by GET /api/v1/job-match/{id}/job-description.

    Provides the full job description text alongside the extracted metadata.
    For old rows (pre-0006), `content` is read from the job_description column.
    For new rows, `content` is fetched from Supabase Storage.
    """

    content: str                    # Full job description text
    job_title: str | None = None
    company_name: str | None = None
    source: str = "storage"         # "storage" | "legacy" — for client awareness
