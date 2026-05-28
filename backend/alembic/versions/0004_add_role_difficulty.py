"""add role and difficulty columns to interviews table

Revision ID: 0004_add_role_difficulty
Revises: 0003_interviews_questions
Create Date: 2026-05-28 00:00:00.000000

Notes
-----
- The original ORM model was missing `role` and `difficulty` columns.
- Migration 0003 defined them in CREATE TABLE, but only ran if the table
  did not already exist. Existing DBs that already had an `interviews` table
  from an older schema are missing these columns.
- This migration safely adds them if absent.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

# revision identifiers, used by Alembic.
revision = '0004_add_role_difficulty'
down_revision = '0003_interviews_questions'
branch_labels = None
depends_on = None


def _column_exists(bind, table_name: str, column_name: str) -> bool:
    inspector = inspect(bind)
    cols = [c["name"] for c in inspector.get_columns(table_name)]
    return column_name in cols


def upgrade() -> None:
    bind = op.get_bind()

    # Add `role` column if missing
    if not _column_exists(bind, "interviews", "role"):
        op.add_column(
            "interviews",
            sa.Column("role", sa.String(255), nullable=True),
        )

    # Add `difficulty` column if missing
    if not _column_exists(bind, "interviews", "difficulty"):
        op.add_column(
            "interviews",
            sa.Column(
                "difficulty",
                sa.String(32),
                nullable=True,
                server_default="medium",
            ),
        )


def downgrade() -> None:
    # Only drop if they exist (safe downgrade)
    bind = op.get_bind()
    if _column_exists(bind, "interviews", "difficulty"):
        op.drop_column("interviews", "difficulty")
    if _column_exists(bind, "interviews", "role"):
        op.drop_column("interviews", "role")
