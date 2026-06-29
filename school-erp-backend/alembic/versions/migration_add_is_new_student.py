"""add is_new_student to fee_structures

Revision ID: 4289407dc7c3
Revises: <PUT_YOUR_CURRENT_HEAD_REVISION_HERE>
Create Date: 2026-06-25

IMPORTANT: before running this, open a terminal in school-erp-backend and run:

    alembic heads

That will print the actual current head revision id. Replace the
<PUT_YOUR_CURRENT_HEAD_REVISION_HERE> placeholder below with that value,
otherwise Alembic won't know this migration comes after your existing ones.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '4289407dc7c3'
down_revision = '20260610a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'fee_structures',
        sa.Column(
            'is_new_student',
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column('fee_structures', 'is_new_student')