"""create job_matches table

Revision ID: 0005_create_job_matches
Revises: 0004_add_role_difficulty
Create Date: 2026-06-14 00:00:00.000000

Notes
-----
- Creates the job_matches table for the Job Match Analyzer feature.
- Each row stores one AI-powered match result between a resume and a
  job description.
- jd_hash (SHA-256) + resume_id + created_at enable 24-hour dedup logic
  in the application layer (no DB-level unique constraint needed because
  the dedup window is time-bounded).
- profile_id and resume_id both CASCADE DELETE so job matches are
  automatically purged when the parent profile or resume is deleted.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0005_create_job_matches'
down_revision = '0004_add_role_difficulty'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'job_matches',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            'profile_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('profiles.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column(
            'resume_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('resumes.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('job_description', sa.Text, nullable=False),
        sa.Column('jd_hash', sa.String(64), nullable=False),
        sa.Column('match_score', sa.Integer, nullable=False),
        sa.Column('ats_score', sa.Integer, nullable=False),
        sa.Column(
            'missing_keywords',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default='[]',
        ),
        sa.Column(
            'missing_skills',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default='[]',
        ),
        sa.Column(
            'strengths',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default='[]',
        ),
        sa.Column(
            'recommendations',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default='[]',
        ),
        sa.Column('role_fit', sa.Text, nullable=False, server_default=''),
        sa.Column('interview_readiness', sa.Text, nullable=False, server_default=''),
        sa.Column('summary', sa.Text, nullable=False, server_default=''),
        sa.Column(
            'analysis',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('now()'),
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('now()'),
        ),
    )

    # Indexes for the most common query patterns
    op.create_index('ix_job_matches_profile_id', 'job_matches', ['profile_id'])
    op.create_index('ix_job_matches_resume_id',  'job_matches', ['resume_id'])
    op.create_index('ix_job_matches_jd_hash',    'job_matches', ['jd_hash'])
    op.create_index(
        'ix_job_matches_created_at',
        'job_matches',
        [sa.text('created_at DESC')],
    )


def downgrade() -> None:
    op.drop_index('ix_job_matches_created_at', table_name='job_matches')
    op.drop_index('ix_job_matches_jd_hash',    table_name='job_matches')
    op.drop_index('ix_job_matches_resume_id',  table_name='job_matches')
    op.drop_index('ix_job_matches_profile_id', table_name='job_matches')
    op.drop_table('job_matches')
