"""homework_table

Revision ID: f57bc06f51c4
Revises: 2adc41ef0a85
Create Date: 2026-05-27 22:52:55.482683

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'f57bc06f51c4'
down_revision: Union[str, None] = '2adc41ef0a85'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('homework_assignments',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('course', sa.String(length=100), nullable=True),
        sa.Column('course_name', sa.String(length=200), nullable=True),
        sa.Column('student_group', sa.String(length=100), nullable=True),
        sa.Column('class_name', sa.String(length=100), nullable=True),
        sa.Column('academic_year', sa.String(length=50), nullable=True),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('max_points', sa.Integer(), nullable=True),
        sa.Column('assigned_by', sa.String(length=100), nullable=True),
        sa.Column('assigned_by_name', sa.String(length=200), nullable=True),
        sa.Column('assigned_date', sa.Date(), server_default=sa.text('CURRENT_DATE'), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('gc_course_id', sa.String(length=100), nullable=True),
        sa.Column('gc_course_work_id', sa.String(length=100), nullable=True),
        sa.Column('gc_invite_code', sa.String(length=100), nullable=True),
        sa.Column('gc_course_link', sa.String(length=500), nullable=True),
        sa.Column('sync_status', sa.String(length=50), nullable=True),
        sa.Column('sync_error', sa.Text(), nullable=True),
        sa.Column('gc_attempted_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('homework_assignments')
