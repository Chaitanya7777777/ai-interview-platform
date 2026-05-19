from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ResumeAnalysisResponse(BaseModel):
    """
    Structured AI analysis of a resume.

    Matches the exact JSON schema enforced by resume_analysis.txt.
    Validated by Pydantic — any field missing or wrong type raises ValidationError.
    """

    overall_score: int = Field(ge=0, le=100, description="Holistic quality score 0-100")
    strengths: list[str] = Field(min_length=1, description="What the candidate does well")
    weaknesses: list[str] = Field(min_length=1, description="Gaps or red flags")
    missing_skills: list[str] = Field(min_length=1, description="Skills absent but expected")
    recommended_roles: list[str] = Field(min_length=1, description="Best-matching job titles")
    improvement_suggestions: list[str] = Field(min_length=1, description="Concrete edits to make")



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
