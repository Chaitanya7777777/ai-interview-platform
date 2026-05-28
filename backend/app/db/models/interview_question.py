from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.base import Base


class InterviewQuestion(Base):
    """
    One AI-generated question within an interview session.

    Lifecycle
    ---------
    - Created (with question text + expected_answer_points) when the interview
      is generated via POST /api/v1/interviews/generate.
    - Updated (user_answer, ai_feedback, ai_score, ideal_answer,
      improvement_suggestions) when the user submits an answer and AI evaluates it.
    """

    __tablename__ = "interview_questions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    interview_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("interviews.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # AI-generated question content
    question: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False, default="general")
    difficulty: Mapped[str] = mapped_column(String(16), nullable=False, default="medium")
    expected_answer_points: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # User response + AI evaluation (filled after answer submission)
    user_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_score: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1-10
    ideal_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    improvement_suggestions: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    interview = relationship("Interview", back_populates="questions")
