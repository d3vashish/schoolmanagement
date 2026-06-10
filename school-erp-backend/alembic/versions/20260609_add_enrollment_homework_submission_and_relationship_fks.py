"""add_enrollment_homework_submission_and_relationship_fks

Revision ID: 20260609
Revises: f747a6e0cc72
Create Date: 2026-06-09 21:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260609"
down_revision: Union[str, None] = "f747a6e0cc72"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Create enrollments table ---
    op.create_table(
        "enrollments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("class_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("section_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("academic_year_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("roll_number", sa.String(20), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="ACTIVE"),
        sa.Column("enrolled_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("left_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["student_profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["class_id"], ["academic_classes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["section_id"], ["academic_sections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["academic_year_id"], ["academic_years.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("student_id", "academic_year_id", name="uq_enrollment_student_year"),
    )
    op.create_index(op.f("ix_enrollments_student_id"), "enrollments", ["student_id"])
    op.create_index(op.f("ix_enrollments_status"), "enrollments", ["status"])

    # --- Create homework_submissions table ---
    op.create_table(
        "homework_submissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("homework_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("submission_text", sa.Text(), nullable=True),
        sa.Column("file_url", sa.String(500), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="SUBMITTED"),
        sa.Column("marks", sa.Integer(), nullable=True),
        sa.Column("graded_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("graded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["homework_id"], ["homework_assignments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["student_profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["graded_by"], ["staff_profiles.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("homework_id", "student_id", name="uq_homework_submission_student"),
    )
    op.create_index(op.f("ix_homework_submissions_homework_id"), "homework_submissions", ["homework_id"])
    op.create_index(op.f("ix_homework_submissions_student_id"), "homework_submissions", ["student_id"])

    # --- Add FK columns to homework_assignments ---
    op.add_column("homework_assignments", sa.Column("section_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("homework_assignments", sa.Column("subject_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("homework_assignments", sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_homework_assignments_section_id", "homework_assignments", "academic_sections", ["section_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_homework_assignments_subject_id", "homework_assignments", "academic_subjects", ["subject_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_homework_assignments_created_by_id", "homework_assignments", "staff_profiles", ["created_by_id"], ["id"], ondelete="SET NULL")
    op.create_index(op.f("ix_homework_assignments_section_id"), "homework_assignments", ["section_id"])
    op.create_index(op.f("ix_homework_assignments_subject_id"), "homework_assignments", ["subject_id"])

    # --- Add FK columns to attendance ---
    op.add_column("attendance", sa.Column("section_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("attendance", sa.Column("subject_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("attendance", sa.Column("academic_year_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_attendance_section_id", "attendance", "academic_sections", ["section_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_attendance_subject_id", "attendance", "academic_subjects", ["subject_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_attendance_academic_year_id", "attendance", "academic_years", ["academic_year_id"], ["id"], ondelete="SET NULL")
    op.create_index(op.f("ix_attendance_section_id"), "attendance", ["section_id"])
    op.create_index(op.f("ix_attendance_subject_id"), "attendance", ["subject_id"])
    op.create_index(op.f("ix_attendance_academic_year_id"), "attendance", ["academic_year_id"])

    # --- Add FK columns to invoices ---
    op.add_column("invoices", sa.Column("section_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("invoices", sa.Column("academic_year_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_invoices_section_id", "invoices", "academic_sections", ["section_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_invoices_academic_year_id", "invoices", "academic_years", ["academic_year_id"], ["id"], ondelete="SET NULL")
    op.create_index(op.f("ix_invoices_section_id"), "invoices", ["section_id"])
    op.create_index(op.f("ix_invoices_academic_year_id"), "invoices", ["academic_year_id"])

    # --- Add section_id to exams + modify academic_year_id FK ---
    op.add_column("exams", sa.Column("section_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_exams_section_id", "exams", "academic_sections", ["section_id"], ["id"], ondelete="SET NULL")
    op.create_index(op.f("ix_exams_section_id"), "exams", ["section_id"])
    # Recreate academic_year_id FK with SET NULL + add index
    op.drop_constraint("exams_academic_year_id_fkey", "exams", type_="foreignkey")
    op.alter_column("exams", "academic_year_id", nullable=True, existing_type=postgresql.UUID(as_uuid=True), existing_nullable=False)
    op.create_index(op.f("ix_exams_academic_year_id"), "exams", ["academic_year_id"])
    op.create_foreign_key("fk_exams_academic_year_id", "exams", "academic_years", ["academic_year_id"], ["id"], ondelete="SET NULL")

    # --- Add section_id to exam_results ---
    op.add_column("exam_results", sa.Column("section_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_exam_results_section_id", "exam_results", "academic_sections", ["section_id"], ["id"], ondelete="SET NULL")
    op.create_index(op.f("ix_exam_results_section_id"), "exam_results", ["section_id"])

    # --- Add section_id to exam_aggregates ---
    op.add_column("exam_aggregates", sa.Column("section_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_exam_aggregates_section_id", "exam_aggregates", "academic_sections", ["section_id"], ["id"], ondelete="SET NULL")
    op.create_index(op.f("ix_exam_aggregates_section_id"), "exam_aggregates", ["section_id"])

    # --- Add section_id to report_cards ---
    op.add_column("report_cards", sa.Column("section_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_report_cards_section_id", "report_cards", "academic_sections", ["section_id"], ["id"], ondelete="SET NULL")
    op.create_index(op.f("ix_report_cards_section_id"), "report_cards", ["section_id"])

    # --- Add designation to staff_profiles ---
    op.add_column("staff_profiles", sa.Column("designation", sa.String(100), nullable=True))

    # --- Add roll_number to student_profiles ---
    op.add_column("student_profiles", sa.Column("roll_number", sa.String(20), nullable=True))


def downgrade() -> None:
    # Remove roll_number from student_profiles
    op.drop_column("student_profiles", "roll_number")

    # Remove designation from staff_profiles
    op.drop_column("staff_profiles", "designation")

    # Remove section_id from report_cards
    op.drop_index(op.f("ix_report_cards_section_id"), table_name="report_cards")
    op.drop_constraint("fk_report_cards_section_id", "report_cards", type_="foreignkey")
    op.drop_column("report_cards", "section_id")

    # Remove section_id from exam_aggregates
    op.drop_index(op.f("ix_exam_aggregates_section_id"), table_name="exam_aggregates")
    op.drop_constraint("fk_exam_aggregates_section_id", "exam_aggregates", type_="foreignkey")
    op.drop_column("exam_aggregates", "section_id")

    # Remove section_id from exam_results
    op.drop_index(op.f("ix_exam_results_section_id"), table_name="exam_results")
    op.drop_constraint("fk_exam_results_section_id", "exam_results", type_="foreignkey")
    op.drop_column("exam_results", "section_id")

    # Revert exams: drop section_id, restore academic_year_id FK
    op.drop_index(op.f("ix_exams_section_id"), table_name="exams")
    op.drop_constraint("fk_exams_section_id", "exams", type_="foreignkey")
    op.drop_column("exams", "section_id")
    op.drop_index(op.f("ix_exams_academic_year_id"), table_name="exams")
    op.drop_constraint("fk_exams_academic_year_id", "exams", type_="foreignkey")
    op.alter_column("exams", "academic_year_id", nullable=False, existing_type=postgresql.UUID(as_uuid=True), existing_nullable=True)
    op.create_foreign_key(None, "exams", "academic_years", ["academic_year_id"], ["id"])

    # Remove columns from invoices
    op.drop_index(op.f("ix_invoices_section_id"), table_name="invoices")
    op.drop_index(op.f("ix_invoices_academic_year_id"), table_name="invoices")
    op.drop_constraint("fk_invoices_section_id", "invoices", type_="foreignkey")
    op.drop_constraint("fk_invoices_academic_year_id", "invoices", type_="foreignkey")
    op.drop_column("invoices", "section_id")
    op.drop_column("invoices", "academic_year_id")

    # Remove columns from attendance
    op.drop_index(op.f("ix_attendance_section_id"), table_name="attendance")
    op.drop_index(op.f("ix_attendance_subject_id"), table_name="attendance")
    op.drop_index(op.f("ix_attendance_academic_year_id"), table_name="attendance")
    op.drop_constraint("fk_attendance_section_id", "attendance", type_="foreignkey")
    op.drop_constraint("fk_attendance_subject_id", "attendance", type_="foreignkey")
    op.drop_constraint("fk_attendance_academic_year_id", "attendance", type_="foreignkey")
    op.drop_column("attendance", "section_id")
    op.drop_column("attendance", "subject_id")
    op.drop_column("attendance", "academic_year_id")

    # Remove columns from homework_assignments
    op.drop_index(op.f("ix_homework_assignments_section_id"), table_name="homework_assignments")
    op.drop_index(op.f("ix_homework_assignments_subject_id"), table_name="homework_assignments")
    op.drop_constraint("fk_homework_assignments_section_id", "homework_assignments", type_="foreignkey")
    op.drop_constraint("fk_homework_assignments_subject_id", "homework_assignments", type_="foreignkey")
    op.drop_constraint("fk_homework_assignments_created_by_id", "homework_assignments", type_="foreignkey")
    op.drop_column("homework_assignments", "section_id")
    op.drop_column("homework_assignments", "subject_id")
    op.drop_column("homework_assignments", "created_by_id")

    # Drop homework_submissions
    op.drop_index(op.f("ix_homework_submissions_student_id"), table_name="homework_submissions")
    op.drop_index(op.f("ix_homework_submissions_homework_id"), table_name="homework_submissions")
    op.drop_table("homework_submissions")

    # Drop enrollments
    op.drop_index(op.f("ix_enrollments_status"), table_name="enrollments")
    op.drop_index(op.f("ix_enrollments_student_id"), table_name="enrollments")
    op.drop_table("enrollments")
