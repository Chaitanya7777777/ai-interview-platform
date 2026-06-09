"""
interview_service.py
--------------------
Database persistence layer for the Interview feature.

Responsibilities
----------------
- Create an interview session + bulk-insert AI-generated questions.
- Fetch interview history (paginated) for a profile.
- Fetch a single interview with all its questions.
- Save AI evaluation for a single question.
- Finalize an interview once all questions are answered.

Architecture
------------
All functions accept AsyncSession so the route layer controls the transaction.
No AI calls happen here — AI is called in the route, results passed in.
No N+1 queries — questions are always fetched with selectinload or in-bulk.
"""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import asc, delete, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.interview import Interview
from app.db.models.interview_question import InterviewQuestion
from app.db.models.resume import Resume
from app.schemas.ai import InterviewQuestion as AIQuestion
from app.schemas.interview import (
    InterviewDetailOut,
    InterviewHistoryItem,
    InterviewHistoryPage,
    InterviewQuestionOut,
    InterviewSessionOut,
    QuestionEvaluationOut,
)

logger = logging.getLogger(__name__)

MAX_PAGE_SIZE = 50


# ── Write operations ──────────────────────────────────────────────────────────

async def create_interview_session(
    session: AsyncSession,
    *,
    profile_id: UUID,
    resume_id: UUID,
    role: str,
    difficulty: str,
    ai_questions: list[AIQuestion],
) -> InterviewSessionOut:
    """
    Create an Interview row + bulk-insert InterviewQuestion rows.

    Parameters
    ----------
    session      : active async SQLAlchemy session
    profile_id   : UUID of the owning Profile
    resume_id    : UUID of the source Resume
    role         : target job role string
    difficulty   : "easy" | "medium" | "hard"
    ai_questions : validated InterviewQuestionSet.questions from the AI service

    Returns
    -------
    InterviewSessionOut with the new interview_id and all questions.
    """
    interview = Interview(
        profile_id=profile_id,
        resume_id=resume_id,
        title=f"Mock Interview — {role}",
        role=role,
        difficulty=difficulty,
        interview_type="mock",
        status="active",
    )
    session.add(interview)
    await session.flush()  # get interview.id

    question_rows: list[InterviewQuestion] = []
    for idx, q in enumerate(ai_questions):
        row = InterviewQuestion(
            interview_id=interview.id,
            question=q.question,
            category=q.category,
            difficulty=q.difficulty,
            expected_answer_points=q.expected_answer_points,
            order_index=idx,
        )
        session.add(row)
        question_rows.append(row)

    await session.flush()

    logger.info(
        "Created interview %s for profile %s (%d questions)",
        interview.id,
        profile_id,
        len(question_rows),
    )

    return InterviewSessionOut(
        interview_id=interview.id,
        role=role,
        difficulty=difficulty,
        status=interview.status,
        questions=[InterviewQuestionOut.model_validate(q) for q in question_rows],
        created_at=interview.created_at,
    )


async def save_question_evaluation(
    session: AsyncSession,
    *,
    interview_id: UUID,
    question_id: UUID,
    profile_id: UUID,
    user_answer: str,
    score: int,
    feedback: str,
    ideal_answer: str,
    improvement_suggestions: list[str],
) -> QuestionEvaluationOut:
    """
    Persist AI evaluation for one question. Finalize the interview if it
    was the last unanswered question.

    Parameters
    ----------
    session                 : active async SQLAlchemy session
    interview_id            : UUID of the parent Interview
    question_id             : UUID of the InterviewQuestion to update
    profile_id              : UUID used to verify ownership
    user_answer             : the submitted answer text
    score / feedback / ...  : AI evaluation fields

    Returns
    -------
    QuestionEvaluationOut  — includes is_last_question and interview_complete flags.

    Raises
    ------
    ValueError  : question not found, wrong interview, or already answered.
    PermissionError : interview belongs to a different profile.
    """
    # Fetch interview with questions in one query
    stmt = (
        select(Interview)
        .where(Interview.id == interview_id)
        .options(selectinload(Interview.questions))
    )
    result = await session.execute(stmt)
    interview = result.scalars().first()

    if not interview:
        raise ValueError(f"Interview {interview_id} not found.")
    if interview.profile_id != profile_id:
        raise PermissionError("You do not own this interview.")

    # Find the target question
    target_q: InterviewQuestion | None = next(
        (q for q in interview.questions if q.id == question_id), None
    )
    if not target_q:
        raise ValueError(f"Question {question_id} not found in interview {interview_id}.")
    if target_q.user_answer is not None:
        raise ValueError("This question has already been answered.")

    # Persist evaluation
    target_q.user_answer = user_answer
    target_q.ai_score = score
    target_q.ai_feedback = feedback
    target_q.ideal_answer = ideal_answer
    target_q.improvement_suggestions = improvement_suggestions
    await session.flush()

    # Check if all questions are now answered
    unanswered = [q for q in interview.questions if q.user_answer is None]
    is_last = len(unanswered) == 0

    overall_score: int | None = None
    if is_last:
        overall_score = _compute_overall_score(interview.questions)
        interview.overall_score = overall_score
        interview.status = "completed"
        await session.flush()
        logger.info(
            "Interview %s completed. Overall score: %d", interview_id, overall_score
        )

    return QuestionEvaluationOut(
        question_id=question_id,
        score=score,
        feedback=feedback,
        ideal_answer=ideal_answer,
        improvement_suggestions=improvement_suggestions,
        is_last_question=is_last,
        interview_complete=is_last,
        overall_score=overall_score,
    )


def _compute_overall_score(questions: list[InterviewQuestion]) -> int:
    """
    Compute a 0-100 overall score from per-question 1-10 scores.

    Scales: (avg_of_1_to_10 / 10) * 100, rounded to nearest int.
    """
    scores = [q.ai_score for q in questions if isinstance(q.ai_score, int)]
    if not scores:
        return 0
    avg = sum(scores) / len(scores)
    return round((avg / 10) * 100)


# ── Read operations ───────────────────────────────────────────────────────────

async def get_interview_history(
    session: AsyncSession,
    *,
    profile_id: UUID,
    page: int = 1,
    page_size: int = 10,
) -> InterviewHistoryPage:
    """
    Return paginated interview history for a profile, newest-first.

    Includes question_count and answered_count computed from the questions
    relationship — fetched with selectinload to avoid N+1.
    """
    page_size = min(page_size, MAX_PAGE_SIZE)
    offset = (page - 1) * page_size

    count_stmt = (
        select(func.count())
        .where(Interview.profile_id == profile_id)
        .select_from(Interview)
    )
    total_count: int = (await session.execute(count_stmt)).scalar_one()

    rows_stmt = (
        select(Interview)
        .where(Interview.profile_id == profile_id)
        .options(selectinload(Interview.questions))
        .order_by(desc(Interview.created_at))
        .offset(offset)
        .limit(page_size)
    )
    result = await session.execute(rows_stmt)
    interviews = list(result.scalars().all())

    total_pages = max(1, -(-total_count // page_size))

    items: list[InterviewHistoryItem] = []
    for iv in interviews:
        item = InterviewHistoryItem.model_validate(iv)
        item.question_count = len(iv.questions)
        item.answered_count = sum(1 for q in iv.questions if q.user_answer is not None)
        item.role = getattr(iv, "role", None) or iv.title
        items.append(item)

    return InterviewHistoryPage(
        items=items,
        total_count=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )


async def get_interview_detail(
    session: AsyncSession,
    *,
    interview_id: UUID,
    profile_id: UUID,
) -> InterviewDetailOut:
    """
    Fetch a single interview with all its questions.

    Raises
    ------
    ValueError      : interview not found.
    PermissionError : interview belongs to a different profile.
    """
    stmt = (
        select(Interview)
        .where(Interview.id == interview_id)
        .options(selectinload(Interview.questions))
    )
    result = await session.execute(stmt)
    interview = result.scalars().first()

    if not interview:
        raise ValueError(f"Interview {interview_id} not found.")
    if interview.profile_id != profile_id:
        raise PermissionError("You do not own this interview.")

    return InterviewDetailOut(
        id=interview.id,
        role=getattr(interview, "role", None) or interview.title,
        difficulty=getattr(interview, "difficulty", None),
        status=interview.status,
        overall_score=interview.overall_score,
        summary=interview.summary,
        questions=[InterviewQuestionOut.model_validate(q) for q in interview.questions],
        created_at=interview.created_at,
        updated_at=interview.updated_at,
    )


async def get_resume_for_interview(
    session: AsyncSession,
    *,
    resume_id: UUID,
    profile_id: UUID,
) -> Resume:
    """
    Fetch a resume and verify it belongs to the requesting profile.

    Raises
    ------
    ValueError      : resume not found or not owned by this profile.
    """
    stmt = select(Resume).where(Resume.id == resume_id, Resume.profile_id == profile_id)
    result = await session.execute(stmt)
    resume = result.scalars().first()

    if not resume:
        raise ValueError(
            f"Resume {resume_id} not found or does not belong to your account."
        )
    return resume


# ── Delete operations ─────────────────────────────────────────────────────────

async def delete_interview_session(
    session: AsyncSession,
    *,
    interview_id: UUID,
    profile_id: UUID,
) -> None:
    """
    Delete an interview session owned by the given profile.

    Uses a raw SQL DELETE (not session.delete) to avoid SQLAlchemy ORM cascade
    loading the `messages` relationship whose table may not exist in the DB.
    Child rows (interview_questions) are cleaned up by the DB-level ON DELETE CASCADE FK.

    Raises
    ------
    ValueError      : interview not found or does not belong to this profile.
    PermissionError : profile mismatch.
    """
    # First verify ownership — only fetch id + profile_id, no relationship loading
    check_stmt = select(Interview.id, Interview.profile_id).where(
        Interview.id == interview_id
    )
    result = await session.execute(check_stmt)
    row = result.first()

    if row is None:
        raise ValueError(f"Interview {interview_id} not found.")

    if row.profile_id != profile_id:
        raise PermissionError("You do not have permission to delete this interview.")

    # Raw SQL DELETE — bypasses ORM cascade, relies on DB FK ON DELETE CASCADE
    del_stmt = delete(Interview).where(
        Interview.id == interview_id,
        Interview.profile_id == profile_id,
    )
    await session.execute(del_stmt)
    await session.flush()
    logger.info("Deleted interview %s for profile %s", interview_id, profile_id)
