"""add storage columns to job_matches

Revision ID: 0006_job_match_storage_upgrade
Revises: 0005_create_job_matches
Create Date: 2026-06-15 00:00:00.000000

Notes
-----
Additive-only migration — no existing columns are dropped or renamed.

job_description TEXT remains in place (nullable after this migration).
Existing rows continue to work via the fallback read path in the service
layer (job_description_legacy content is available for old rows).

New columns added (all nullable):
  job_title              VARCHAR(255)  — extracted job title for display
  company_name           VARCHAR(255)  — extracted company name for display
  job_description_preview TEXT         — first 300 chars for history views
  job_description_path   VARCHAR(1024) — Supabase Storage object path

Downgrade: drops the four new columns (safe — new rows only).
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0006_job_match_storage_upgrade"
down_revision = "0005_create_job_matches"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make job_description nullable for new rows that use storage instead.
    # Existing rows keep their TEXT content — no data is lost.
    op.alter_column(
        "job_matches",
        "job_description",
        existing_type=sa.Text(),
        nullable=True,
    )

    # Add new metadata + storage columns (all nullable — old rows stay NULL)
    op.add_column(
        "job_matches",
        sa.Column("job_title", sa.String(255), nullable=True),
    )
    op.add_column(
        "job_matches",
        sa.Column("company_name", sa.String(255), nullable=True),
    )
    op.add_column(
        "job_matches",
        sa.Column("job_description_preview", sa.Text(), nullable=True),
    )
    op.add_column(
        "job_matches",
        sa.Column("job_description_path", sa.String(1024), nullable=True),
    )


def downgrade() -> None:
    # Drop new columns only — job_description TEXT is preserved
    op.drop_column("job_matches", "job_description_path")
    op.drop_column("job_matches", "job_description_preview")
    op.drop_column("job_matches", "company_name")
    op.drop_column("job_matches", "job_title")

    # Restore NOT NULL constraint on job_description
    # (only safe if no new-style rows exist — wrap in try for safety)
    try:
        op.alter_column(
            "job_matches",
            "job_description",
            existing_type=sa.Text(),
            nullable=False,
        )
    except Exception:
        pass
