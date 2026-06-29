"""add_class_tests

Revision ID: 37d01b5ecba4
Revises: c409bf3b1959
Create Date: 2026-06-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "37d01b5ecba4"
down_revision: Union[str, None] = "c409bf3b1959"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "class_tests",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("section_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("test_date", sa.Date(), nullable=True),
        sa.Column("max_marks", sa.Numeric(6, 2), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["section_id"], ["academic_sections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"],),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_class_tests_section_id"), "class_tests", ["section_id"])

    op.create_table(
        "class_test_marks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("test_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("marks_obtained", sa.Numeric(6, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["test_id"], ["class_tests.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["student_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("test_id", "student_id", name="uq_class_test_mark_student"),
    )
    op.create_index(op.f("ix_class_test_marks_test_id"), "class_test_marks", ["test_id"])
    op.create_index(op.f("ix_class_test_marks_student_id"), "class_test_marks", ["student_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_class_test_marks_student_id"), table_name="class_test_marks")
    op.drop_index(op.f("ix_class_test_marks_test_id"), table_name="class_test_marks")
    op.drop_table("class_test_marks")
    op.drop_index(op.f("ix_class_tests_section_id"), table_name="class_tests")
    op.drop_table("class_tests")