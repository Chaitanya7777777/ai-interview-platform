"""create resumes table

Revision ID: 0002_create_resumes
Revises: 0001_create_profiles
Create Date: 2026-05-20 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0002_create_resumes'
down_revision = '0001_create_profiles'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'resumes',

        # Primary key
        sa.Column(
            'id',
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),

        # Foreign key → profiles.id (CASCADE on delete)
        sa.Column(
            'profile_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('profiles.id', ondelete='CASCADE'),
            nullable=False,
        ),

        # File metadata
        sa.Column('file_name', sa.String(length=255), nullable=False),
        sa.Column('file_url',  sa.String(length=1024), nullable=False, server_default=''),
        sa.Column('file_size_bytes', sa.Integer, nullable=True),

        # Extracted content
        sa.Column('parsed_text', sa.Text, nullable=True),

        # AI analysis stored as JSONB for flexible querying
        sa.Column('analysis_result', postgresql.JSONB(astext_type=sa.Text()), nullable=True),

        # Processing status: "parsed" | "analysed" | "failed"
        sa.Column('status', sa.String(length=32), nullable=False, server_default='parsed'),

        # Audit timestamps (server-side defaults so inserts without Python tzinfo work)
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
    )

    # Index on profile_id for fast "my resumes" lookups
    op.create_index('ix_resumes_profile_id', 'resumes', ['profile_id'])

    # Index on created_at for efficient ORDER BY created_at DESC
    op.create_index('ix_resumes_created_at', 'resumes', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_resumes_created_at', table_name='resumes')
    op.drop_index('ix_resumes_profile_id', table_name='resumes')
    op.drop_table('resumes')
