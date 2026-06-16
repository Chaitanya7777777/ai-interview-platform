"""create job_match_reports table

Revision ID: 0007_create_job_match_reports
Revises: 0006_job_match_storage_upgrade
Create Date: 2026-06-16 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = "0007_create_job_match_reports"
down_revision = "0006_job_match_storage_upgrade"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "job_match_reports",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "job_match_id",
            UUID(as_uuid=True),
            sa.ForeignKey("job_matches.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "profile_id",
            UUID(as_uuid=True),
            sa.ForeignKey("profiles.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("report_path", sa.String(1024), nullable=False),
        sa.Column("report_version", sa.String(50), nullable=False),
        sa.Column("report_hash", sa.String(64), nullable=False, index=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("job_match_reports")
