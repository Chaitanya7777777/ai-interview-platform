"""
interview.py  (route)
---------------------
FastAPI router for the AI Mock Interview system.

Endpoints
---------
POST /api/v1/interviews/generate
    Generate interview questions from a resume and start a session.

POST /api/v1/interviews/{interview_id}/evaluate
    Submit and evaluate one answer with AI.

GET  /api/v1/interviews/history
    Paginated list of past interview sessions.

GET  /api/v1/interviews/{interview_id}
    Full interview detail with all questions, answers, and feedback.

Architecture
------------
All DB logic lives in interview_service.py.
All AI logic lives in ai_service.py.
This file only orchestrates and handles HTTP-level concerns.
"""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db_session
from app.schemas.auth import SupabaseUser
from app.schemas.interview import (
    EvaluateAnswerRequest,
    GenerateInterviewRequest,
    InterviewDetailOut,
    InterviewHistoryPage,
    InterviewSessionOut,
    QuestionEvaluationOut,
)
from app.services.ai_service import ai_service
from app.services.interview_service import (
    create_interview_session,
    get_interview_detail,
    get_interview_history,
    get_resume_for_interview,
    save_question_evaluation,
)
from app.services.profile_service import get_or_create_profile

router = APIRouter(prefix="/interviews", tags=["interviews"])
logger = logging.getLogger(__name__)

MAX_PAGE_SIZE = 50


@router.post(
    "/generate",
    response_model=InterviewSessionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a mock interview session",
    description=(
        "Generate 7 AI interview questions tailored to the candidate's resume "
        "and the target role. Creates and persists an interview session. "
        "Questions mix technical, behavioral, and situational types."
    ),
)
async def generate_interview(
    body: GenerateInterviewRequest,
    current_user: SupabaseUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> InterviewSessionOut:
    """
    1. Resolve profile.
    2. Fetch + verify the resume belongs to this user.
    3. Build candidate_context from resume text + analysis.
    4. Call AI to generate questions.
    5. Persist interview session + questions.
    6. Return the session.
    """
    profile = await get_or_create_profile(session, current_user)

    # Fetch resume (validates ownership)
    try:
        resume = await get_resume_for_interview(
            session, resume_id=body.resume_id, profile_id=profile.id
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    if not resume.parsed_text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Resume has no parsed text. Please re-upload the file.",
        )

    # Build candidate_context: combine parsed text with analysis highlights
    candidate_context = resume.parsed_text[:3000]  # truncate for prompt safety
    if resume.analysis_result and isinstance(resume.analysis_result, dict):
        skills = resume.analysis_result.get("missing_skills", [])
        strengths = resume.analysis_result.get("strengths", [])
        if strengths:
            candidate_context += f"\n\nKey strengths: {', '.join(strengths[:5])}"
        if skills:
            candidate_context += f"\nAreas to improve: {', '.join(skills[:5])}"

    # Generate questions via AI
    try:
        question_set = await ai_service.generate_interview_questions(
            candidate_context=candidate_context,
            role_focus=body.role,
            difficulty=body.difficulty,
        )
    except Exception as exc:
        logger.error("AI question generation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is temporarily unavailable. Please try again.",
        ) from exc

    if not question_set.questions:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI returned no questions. Please try again.",
        )

    # Persist to DB
    result = await create_interview_session(
        session,
        profile_id=profile.id,
        resume_id=resume.id,
        role=body.role,
        difficulty=body.difficulty,
        ai_questions=question_set.questions,
    )
    await session.commit()
    return result


@router.post(
    "/{interview_id}/evaluate",
    response_model=QuestionEvaluationOut,
    summary="Submit and evaluate an answer",
    description=(
        "Submit a candidate's answer for one question. "
        "AI scores the answer (1-10), provides feedback, an ideal answer, "
        "and improvement suggestions. "
        "When the last question is answered, the interview is auto-finalized."
    ),
)
async def evaluate_answer(
    interview_id: str,
    body: EvaluateAnswerRequest,
    current_user: SupabaseUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> QuestionEvaluationOut:
    """
    1. Resolve profile.
    2. Fetch the target question (via service — also verifies ownership).
    3. Call AI to evaluate the answer.
    4. Persist result; finalize interview if last question.
    5. Return evaluation.
    """
    from uuid import UUID
    try:
        interview_uuid = UUID(interview_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid interview ID.")

    profile = await get_or_create_profile(session, current_user)

    # We need the question text to call AI — fetch the detail first
    try:
        detail = await get_interview_detail(
            session, interview_id=interview_uuid, profile_id=profile.id
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    if detail.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This interview is already completed.",
        )

    # Find the target question in the detail
    target_q = next((q for q in detail.questions if q.id == body.question_id), None)
    if not target_q:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Question {body.question_id} not found in this interview.",
        )
    if target_q.user_answer is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This question has already been answered.",
        )

    # Call AI evaluation
    try:
        evaluation = await ai_service.evaluate_question_answer(
            question=target_q.question,
            category=target_q.category,
            user_answer=body.answer,
            expected_answer_points=target_q.expected_answer_points or [],
        )
    except Exception as exc:
        logger.error("AI evaluation failed for question %s: %s", body.question_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI evaluation service temporarily unavailable. Please try again.",
        ) from exc

    # Persist
    try:
        result = await save_question_evaluation(
            session,
            interview_id=interview_uuid,
            question_id=body.question_id,
            profile_id=profile.id,
            user_answer=body.answer,
            score=evaluation.score,
            feedback=evaluation.feedback,
            ideal_answer=evaluation.ideal_answer,
            improvement_suggestions=evaluation.improvement_suggestions,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    await session.commit()
    return result


@router.get(
    "/history",
    response_model=InterviewHistoryPage,
    summary="Get interview history",
    description="Paginated list of past interview sessions for the authenticated user.",
)
async def get_history(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=MAX_PAGE_SIZE),
    current_user: SupabaseUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> InterviewHistoryPage:
    profile = await get_or_create_profile(session, current_user)
    return await get_interview_history(
        session, profile_id=profile.id, page=page, page_size=page_size
    )


@router.get(
    "/{interview_id}",
    response_model=InterviewDetailOut,
    summary="Get interview detail",
    description="Full interview with all questions, answers, and AI feedback.",
)
async def get_detail(
    interview_id: str,
    current_user: SupabaseUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> InterviewDetailOut:
    from uuid import UUID
    try:
        interview_uuid = UUID(interview_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid interview ID.")

    profile = await get_or_create_profile(session, current_user)
    try:
        return await get_interview_detail(
            session, interview_id=interview_uuid, profile_id=profile.id
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
