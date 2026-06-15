from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.base import Base


class JobMatch(Base):
    """
    Persisted result of a Job Match analysis.

    Storage architecture (post-0006 migration)
    ------------------------------------------
    New rows:
      - job_description       : NULL (content moved to Storage)
      - job_description_path  : Storage object path (job-descriptions/...)
      - job_description_preview: First 300 chars (for history display)
      - job_title / company_name: Extracted metadata

    Old rows (pre-migration, created before 0006):
      - job_description       : Full TEXT (still readable via fallback)
      - job_description_path  : NULL
      - job_description_preview: NULL

    Dedup
    -----
    One row per unique (resume_id, jd_hash) within a 24-hour window.
    Duplicate submissions update the existing row; the existing Storage
    object is reused (same hash = same content = no re-upload needed).
    """

    __tablename__ = "job_matches"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    resume_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("resumes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Legacy full-text column (pre-0006 rows only) ──────────────────────────
    # Nullable after migration 0006. New rows use job_description_path instead.
    job_description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Storage-backed columns (0006+) ────────────────────────────────────────
    # Storage object path — e.g. "job-descriptions/{profile_id}/{date}_{uid}.txt"
    job_description_path: Mapped[str | None] = mapped_column(
        String(1024), nullable=True
    )
    # First 300 characters of the JD — shown in history without a storage fetch
    job_description_preview: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Extracted display metadata
    job_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # ── Dedup hash ────────────────────────────────────────────────────────────
    # SHA-256 hex digest of the normalized JD — used for 24-hour dedup check
    jd_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    # ── Primary scoring ───────────────────────────────────────────────────────
    match_score: Mapped[int] = mapped_column(Integer, nullable=False)
    ats_score: Mapped[int] = mapped_column(Integer, nullable=False)

    # ── Structured AI output (JSONB arrays) ───────────────────────────────────
    missing_keywords: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    missing_skills: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    strengths: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    recommendations: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    # ── Narrative AI output ───────────────────────────────────────────────────
    role_fit: Mapped[str] = mapped_column(Text, nullable=False, default="")
    interview_readiness: Mapped[str] = mapped_column(Text, nullable=False, default="")
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # ── Full raw AI output (preserved for future extensibility) ───────────────
    analysis: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships (read-only navigation — no cascade writes from here)
    profile = relationship("Profile", back_populates="job_matches")
    resume = relationship("Resume", back_populates="job_matches")
