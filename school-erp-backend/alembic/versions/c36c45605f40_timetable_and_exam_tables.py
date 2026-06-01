"""timetable_and_exam_tables

Revision ID: c36c45605f40
Revises: fd9e16d6c9f4
Create Date: 2026-05-27 13:01:22.048960

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "c36c45605f40"
down_revision: Union[str, None] = "fd9e16d6c9f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "grading_schemes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("grade_a_min", sa.Numeric(5, 2), nullable=True),
        sa.Column("grade_b_min", sa.Numeric(5, 2), nullable=True),
        sa.Column("grade_c_min", sa.Numeric(5, 2), nullable=True),
        sa.Column("grade_d_min", sa.Numeric(5, 2), nullable=True),
        sa.Column("grade_e_min", sa.Numeric(5, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "timetable_slots",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("section_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subject_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("teacher_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("day_of_week", sa.Integer(), nullable=False),
        sa.Column("period_no", sa.Integer(), nullable=False),
        sa.Column("academic_year_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_published", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["academic_year_id"], ["academic_years.id"],),
        sa.ForeignKeyConstraint(["section_id"], ["academic_sections.id"],),
        sa.ForeignKeyConstraint(["subject_id"], ["academic_subjects.id"],),
        sa.ForeignKeyConstraint(["teacher_id"], ["users.id"],),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("section_id", "day_of_week", "period_no", name="uq_slot_section_day_period"),
        sa.UniqueConstraint("teacher_id", "day_of_week", "period_no", "academic_year_id", name="uq_slot_teacher_day_period"),
    )

    op.create_table(
        "exams",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("academic_year_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("class_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("grading_scheme_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="DRAFT"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["academic_year_id"], ["academic_years.id"],),
        sa.ForeignKeyConstraint(["class_id"], ["academic_classes.id"],),
        sa.ForeignKeyConstraint(["grading_scheme_id"], ["grading_schemes.id"],),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_exams_status"), "exams", ["status"])

    op.create_table(
        "exam_subjects",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("exam_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subject_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("max_marks", sa.Numeric(5, 2), nullable=False),
        sa.Column("date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["exam_id"], ["exams.id"],),
        sa.ForeignKeyConstraint(["subject_id"], ["academic_subjects.id"],),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("exam_id", "subject_id", name="uq_exam_subject"),
    )

    op.create_table(
        "exam_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("exam_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subject_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("marks", sa.Numeric(5, 2), nullable=True),
        sa.Column("max_marks", sa.Numeric(5, 2), nullable=False),
        sa.Column("is_absent", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="DRAFT"),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["exam_id"], ["exams.id"],),
        sa.ForeignKeyConstraint(["student_id"], ["student_profiles.id"],),
        sa.ForeignKeyConstraint(["subject_id"], ["academic_subjects.id"],),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("exam_id", "student_id", "subject_id", name="uq_exam_result_student_subject"),
    )
    op.create_index(op.f("ix_exam_results_exam_id"), "exam_results", ["exam_id"])
    op.create_index(op.f("ix_exam_results_student_id"), "exam_results", ["student_id"])
    op.create_index(op.f("ix_exam_results_status"), "exam_results", ["status"])

    op.create_table(
        "exam_aggregates",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("exam_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("total_marks", sa.Numeric(10, 2), nullable=False),
        sa.Column("max_total", sa.Numeric(10, 2), nullable=False),
        sa.Column("percentage", sa.Numeric(5, 2), nullable=False),
        sa.Column("grade", sa.String(2), nullable=True),
        sa.Column("rank", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["exam_id"], ["exams.id"],),
        sa.ForeignKeyConstraint(["student_id"], ["student_profiles.id"],),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("exam_id", "student_id", name="uq_exam_aggregate_student"),
    )
    op.create_index(op.f("ix_exam_aggregates_exam_id"), "exam_aggregates", ["exam_id"])
    op.create_index(op.f("ix_exam_aggregates_student_id"), "exam_aggregates", ["student_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_exam_aggregates_student_id"), table_name="exam_aggregates")
    op.drop_index(op.f("ix_exam_aggregates_exam_id"), table_name="exam_aggregates")
    op.drop_table("exam_aggregates")
    op.drop_index(op.f("ix_exam_results_status"), table_name="exam_results")
    op.drop_index(op.f("ix_exam_results_student_id"), table_name="exam_results")
    op.drop_index(op.f("ix_exam_results_exam_id"), table_name="exam_results")
    op.drop_table("exam_results")
    op.drop_table("exam_subjects")
    op.drop_index(op.f("ix_exams_status"), table_name="exams")
    op.drop_table("exams")
    op.drop_table("timetable_slots")
    op.drop_table("grading_schemes")
