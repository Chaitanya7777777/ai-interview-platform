"""create profiles table

Revision ID: 0001_create_profiles
Revises: 
Create Date: 2026-05-18 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0001_create_profiles'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'profiles',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('auth_user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('full_name', sa.String(length=255), nullable=True),
        sa.Column('avatar_url', sa.String(length=1024), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_profiles_auth_user_id', 'profiles', ['auth_user_id'])
    op.create_unique_constraint('uq_profiles_auth_user_id', 'profiles', ['auth_user_id'])
    op.create_unique_constraint('uq_profiles_email', 'profiles', ['email'])


def downgrade():
    op.drop_table('profiles')
