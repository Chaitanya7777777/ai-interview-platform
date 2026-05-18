from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ResumeAnalysisResponse(BaseModel):
    summary: str
    overall_score: int = Field(ge=0, le=100)
    strengths: list[str]
    gaps: list[str]
    suggested_roles: list[str]
    suggested_actions: list[str]


class InterviewQuestion(BaseModel):
    question: str
    category: str
    difficulty: Literal["easy", "medium", "hard"]
    expected_answer_points: list[str]


class InterviewQuestionSet(BaseModel):
    questions: list[InterviewQuestion]


class InterviewFeedbackResponse(BaseModel):
    summary: str
    overall_score: int = Field(ge=0, le=100)
    strengths: list[str]
    improvements: list[str]
    follow_up_questions: list[str]
