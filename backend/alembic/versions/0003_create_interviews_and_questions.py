"""create interviews and interview_questions tables

Revision ID: 0003_interviews_questions
Revises: 0002_create_resumes
Create Date: 2026-05-28 00:00:00.000000

Notes
-----
- Creates `interviews` table if it does not already exist
  (the ORM model was defined earlier but no migration existed).
- Creates `interview_questions` as a child table.
- Safe to run on a DB that already has an `interviews` table —
  the op uses `checkfirst=True` / existence checks.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = '0003_interviews_questions'
down_revision = '0002_create_resumes'
branch_labels = None
depends_on = None



def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()

    # ── interviews (create only if absent) ───────────────────────────────────
    if "interviews" not in existing_tables:
        op.create_table(
            "interviews",
            sa.Column(
                "id",
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                nullable=False,
            ),
            sa.Column(
                "profile_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("profiles.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "resume_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("resumes.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("role", sa.String(255), nullable=True),
            sa.Column("difficulty", sa.String(32), nullable=True, server_default="medium"),
            sa.Column("interview_type", sa.String(64), nullable=False, server_default="mock"),
            sa.Column("status", sa.String(32), nullable=False, server_default="active"),
            sa.Column("overall_score", sa.Integer, nullable=True),
            sa.Column("summary", sa.Text, nullable=True),
            sa.Column(
                "ai_metadata",
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=True,
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
        )
        op.create_index("ix_interviews_profile_id", "interviews", ["profile_id"])
        op.create_index("ix_interviews_created_at", "interviews", ["created_at"])

    # ── interview_questions ───────────────────────────────────────────────────
    if "interview_questions" not in existing_tables:
        op.create_table(
            "interview_questions",
            sa.Column(
                "id",
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                nullable=False,
            ),
            sa.Column(
                "interview_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("interviews.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("question", sa.Text, nullable=False),
            sa.Column("category", sa.String(64), nullable=False, server_default="general"),
            sa.Column("difficulty", sa.String(16), nullable=False, server_default="medium"),
            sa.Column(
                "expected_answer_points",
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=True,
            ),
            sa.Column("order_index", sa.Integer, nullable=False, server_default="0"),
            # User response
            sa.Column("user_answer", sa.Text, nullable=True),
            # AI evaluation
            sa.Column("ai_feedback", sa.Text, nullable=True),
            sa.Column("ai_score", sa.Integer, nullable=True),
            sa.Column("ideal_answer", sa.Text, nullable=True),
            sa.Column(
                "improvement_suggestions",
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=True,
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
        )
        op.create_index(
            "ix_interview_questions_interview_id",
            "interview_questions",
            ["interview_id"],
        )


def downgrade() -> None:
    op.drop_index("ix_interview_questions_interview_id", table_name="interview_questions")
    op.drop_table("interview_questions")
    op.drop_index("ix_interviews_created_at", table_name="interviews")
    op.drop_index("ix_interviews_profile_id", table_name="interviews")
    op.drop_table("interviews")
