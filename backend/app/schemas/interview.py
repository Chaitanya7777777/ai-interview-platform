"""
interview.py  (schemas)
-----------------------
Pydantic request/response schemas for the interview feature.

Preserves existing InterviewCreate / InterviewRead / InterviewMessageCreate /
InterviewMessageRead schemas (used by old code).

Adds new schemas for the full interview system:
- GenerateInterviewRequest / EvaluateAnswerRequest
- InterviewQuestionOut / InterviewSessionOut / QuestionEvaluationOut
- InterviewHistoryItem / InterviewHistoryPage / InterviewDetailOut
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ── Legacy schemas (preserved) ────────────────────────────────────────────────

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


# ── Request schemas ───────────────────────────────────────────────────────────

class JobMatchContextRequest(BaseModel):
    focus_topics: list[str] = Field(default_factory=list)


class GenerateInterviewRequest(BaseModel):
    """Input for POST /api/v1/interviews/generate."""

    resume_id: UUID = Field(description="UUID of the resume to base questions on")
    role: str = Field(min_length=2, max_length=255, description="Target job role")
    difficulty: Literal["easy", "medium", "hard"] = Field(
        default="medium",
        description="Interview difficulty level",
    )
    mode: Literal["standard", "job_match"] = Field(
        default="standard",
        description="Mode of interview generation",
    )
    job_match_context: JobMatchContextRequest | None = Field(
        default=None,
        description="Optional job match context containing focus topics",
    )


class EvaluateAnswerRequest(BaseModel):
    """Input for POST /api/v1/interviews/{id}/evaluate."""

    question_id: UUID = Field(description="UUID of the InterviewQuestion to evaluate")
    answer: str = Field(min_length=1, max_length=10_000, description="Candidate's answer text")


# ── Question output ───────────────────────────────────────────────────────────

class InterviewQuestionOut(BaseModel):
    """Single interview question as returned by the API.

    IMPORTANT: expected_answer_points and improvement_suggestions are nullable
    JSONB columns in the DB. Newly-inserted rows have NULL for these fields.
    Pydantic 2 with from_attributes=True reads that raw None and raises
    ValidationError if the declared type is list[str] (not Optional).

    The model_validator(mode='before') coerces None -> [] BEFORE Pydantic
    validates the field types, so the list[str] constraint is never violated.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    question: str
    category: str
    difficulty: str
    expected_answer_points: list[str] = Field(default_factory=list)
    order_index: int
    focus: str | None = None

    # Filled after user submits an answer
    user_answer: str | None = None
    ai_feedback: str | None = None
    ai_score: int | None = None
    ideal_answer: str | None = None
    improvement_suggestions: list[str] = Field(default_factory=list)

    @classmethod
    def model_validate(  # type: ignore[override]
        cls,
        obj: object,
        *,
        strict: bool | None = None,
        from_attributes: bool | None = None,
        context: object = None,
        **kwargs: object,
    ) -> "InterviewQuestionOut":
        """
        Coerce None -> [] for nullable JSONB list fields before Pydantic
        validation runs. Works for both SQLAlchemy ORM objects and plain dicts.
        """
        # ── ORM object path ───────────────────────────────────────────────────
        # SQLAlchemy mapped objects have __mapper__; convert to a plain dict
        # so we can mutate the None values before Pydantic sees them.
        if hasattr(obj, "__mapper__"):
            data: dict = {
                col.key: getattr(obj, col.key)
                for col in obj.__mapper__.column_attrs  # type: ignore[union-attr]
            }
            data["expected_answer_points"] = data.get("expected_answer_points") or []
            data["improvement_suggestions"] = data.get("improvement_suggestions") or []
            data["focus"] = getattr(obj, "focus", None)
            return super().model_validate(
                data, strict=strict, from_attributes=False, context=context
            )

        # ── Plain dict path ───────────────────────────────────────────────────
        if isinstance(obj, dict):
            obj = dict(obj)  # copy — never mutate caller's dict
            obj["expected_answer_points"] = obj.get("expected_answer_points") or []
            obj["improvement_suggestions"] = obj.get("improvement_suggestions") or []
            obj["focus"] = obj.get("focus")

        return super().model_validate(
            obj, strict=strict, from_attributes=from_attributes, context=context
        )



# ── Session / generate response ───────────────────────────────────────────────

class InterviewSessionOut(BaseModel):
    """Returned by POST /api/v1/interviews/generate."""

    interview_id: UUID
    role: str
    difficulty: str
    status: str
    questions: list[InterviewQuestionOut]
    created_at: datetime


# ── Evaluate response ─────────────────────────────────────────────────────────

class QuestionEvaluationOut(BaseModel):
    """Returned by POST /api/v1/interviews/{id}/evaluate."""

    question_id: UUID
    score: int = Field(ge=1, le=10)
    feedback: str
    ideal_answer: str
    improvement_suggestions: list[str]
    is_last_question: bool
    interview_complete: bool
    overall_score: int | None = None


# ── History schemas ───────────────────────────────────────────────────────────

class InterviewHistoryItem(BaseModel):
    """One interview record in the history list."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    role: str | None
    difficulty: str | None
    status: str
    overall_score: int | None
    question_count: int = 0
    answered_count: int = 0
    created_at: datetime
    updated_at: datetime


class InterviewHistoryPage(BaseModel):
    """Paginated response for GET /api/v1/interviews/history."""

    items: list[InterviewHistoryItem]
    total_count: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    total_pages: int = Field(ge=1)
    has_next: bool
    has_prev: bool


# ── Detail response ───────────────────────────────────────────────────────────

class InterviewDetailOut(BaseModel):
    """Full interview with all questions — GET /api/v1/interviews/{id}."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    role: str | None
    difficulty: str | None
    status: str
    overall_score: int | None
    summary: str | None
    questions: list[InterviewQuestionOut]
    created_at: datetime
    updated_at: datetime
