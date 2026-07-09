"""add is_new_student to student_profiles

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-07-09
"""
from alembic import op
import sqlalchemy as sa

revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "student_profiles",
        sa.Column("is_new_student", sa.Boolean(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("student_profiles", "is_new_student")
