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


class QuestionEvaluationResponse(BaseModel):
    """
    Per-question AI evaluation result.

    Matches the JSON schema enforced by question_evaluation.txt.
    score is 1-10 (not 0-100) to give finer granularity per question.
    """

    score: int = Field(ge=1, le=10, description="Answer quality score 1-10")
    feedback: str = Field(description="2-3 sentence constructive assessment")
    ideal_answer: str = Field(description="Model answer the candidate should aim for")
    improvement_suggestions: list[str] = Field(
        min_length=1,
        description="Specific actionable improvements",
    )


class JobMatchAnalysisResponse(BaseModel):
    """
    Structured AI output for the Job Match Analyzer feature.

    Matches the exact JSON schema enforced by job_match.txt.
    Validated by Pydantic — any missing or wrong-type field raises ValidationError.
    """

    match_score: int = Field(ge=0, le=100, description="Resume-to-JD compatibility 0-100")
    ats_score: int = Field(ge=0, le=100, description="ATS keyword match score 0-100")
    strengths: list[str] = Field(min_length=1, description="Resume aspects that directly match the JD")
    missing_keywords: list[str] = Field(min_length=1, description="JD keywords absent from the resume")
    missing_skills: list[str] = Field(min_length=1, description="Capability gaps relative to the JD")
    recommendations: list[str] = Field(min_length=1, description="Actionable resume edits for this role")
    role_fit: str = Field(description="2-3 sentence narrative on overall role fit")
    interview_readiness: str = Field(description="1-2 sentence interview readiness assessment")
    summary: str = Field(description="2-3 sentence executive summary of the match")
