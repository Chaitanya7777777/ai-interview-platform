"""
dashboard.py  (schemas)
-----------------------
Pydantic response schemas for GET /api/v1/dashboard/analytics.

All fields are Optional-safe — empty states return zeroed values,
never 422 or 500 errors.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class ScoreTrendPoint(BaseModel):
    """One data point on the ATS score timeline."""

    date: str = Field(description="ISO date string — YYYY-MM-DD")
    score: int = Field(ge=0, le=100, description="ATS overall_score for this upload")


class MissingSkillCount(BaseModel):
    """Frequency of a single missing skill across all analysed resumes."""

    skill: str
    count: int = Field(ge=1)


class RecommendedRoleCount(BaseModel):
    """Frequency of a recommended role across all analysed resumes."""

    role: str
    count: int = Field(ge=1)


class DashboardAnalyticsResponse(BaseModel):
    """
    Full analytics payload returned by GET /api/v1/dashboard/analytics.

    Derived exclusively from the resumes.analysis_result JSONB field.
    Resumes without a completed analysis (status != 'analysed') are ignored.
    """

    total_resumes: int = Field(ge=0, description="Total resumes uploaded by this user")
    analysed_resumes: int = Field(ge=0, description="Resumes with completed AI analysis")
    average_score: float = Field(ge=0, le=100, description="Mean overall_score across analysed resumes")
    best_score: int = Field(ge=0, le=100, description="Highest overall_score across analysed resumes")

    score_trend: list[ScoreTrendPoint] = Field(
        default_factory=list,
        description="ATS score per upload, ordered by upload date ascending",
    )
    missing_skills: list[MissingSkillCount] = Field(
        default_factory=list,
        description="Top missing skills sorted by frequency descending",
    )
    recommended_roles: list[RecommendedRoleCount] = Field(
        default_factory=list,
        description="Top recommended roles sorted by frequency descending",
    )
