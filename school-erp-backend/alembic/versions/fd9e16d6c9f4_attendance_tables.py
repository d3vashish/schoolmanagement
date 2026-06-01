"""attendance_tables

Revision ID: fd9e16d6c9f4
Revises: 8532c3b3be21
Create Date: 2026-05-27 12:58:08.513447

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "fd9e16d6c9f4"
down_revision: Union[str, None] = "8532c3b3be21"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "leave_types",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("is_paid", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "attendance",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("period_no", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(10), nullable=False),
        sa.Column("marked_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_corrected", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("corrected_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["marked_by"], ["users.id"],),
        sa.ForeignKeyConstraint(["student_id"], ["student_profiles.id"],),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("student_id", "date", "period_no", name="uq_attendance_student_date_period"),
    )
    op.create_index(op.f("ix_attendance_student_id"), "attendance", ["student_id"])
    op.create_index(op.f("ix_attendance_date"), "attendance", ["date"])

    op.create_table(
        "leave_applications",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("leave_type_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="PENDING"),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("approved_at", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["approved_by"], ["users.id"],),
        sa.ForeignKeyConstraint(["leave_type_id"], ["leave_types.id"],),
        sa.ForeignKeyConstraint(["student_id"], ["student_profiles.id"],),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_leave_applications_student_id"), "leave_applications", ["student_id"])
    op.create_index(op.f("ix_leave_applications_status"), "leave_applications", ["status"])


def downgrade() -> None:
    op.drop_index(op.f("ix_leave_applications_status"), table_name="leave_applications")
    op.drop_index(op.f("ix_leave_applications_student_id"), table_name="leave_applications")
    op.drop_table("leave_applications")
    op.drop_index(op.f("ix_attendance_date"), table_name="attendance")
    op.drop_index(op.f("ix_attendance_student_id"), table_name="attendance")
    op.drop_table("attendance")
    op.drop_table("leave_types")
