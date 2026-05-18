"""${message}
"""
from alembic import op
import sqlalchemy as sa


def upgrade():
% for stmt in upgrade_ops:
    ${stmt}
% endfor


def downgrade():
% for stmt in downgrade_ops:
    ${stmt}
% endfor
