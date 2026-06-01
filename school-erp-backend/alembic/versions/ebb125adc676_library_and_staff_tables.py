"""library_and_staff_tables

Revision ID: ebb125adc676
Revises: c36c45605f40
Create Date: 2026-05-27 13:04:07.838733

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "ebb125adc676"
down_revision: Union[str, None] = "c36c45605f40"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "book_categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "books",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("author", sa.String(200), nullable=False),
        sa.Column("isbn", sa.String(20), nullable=True),
        sa.Column("publisher", sa.String(200), nullable=True),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("total_copies", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["book_categories.id"],),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("isbn"),
    )

    op.create_table(
        "book_copies",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("book_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("barcode", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="AVAILABLE"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"],),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("barcode"),
    )
    op.create_index(op.f("ix_book_copies_status"), "book_copies", ["status"])

    op.create_table(
        "book_reservations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("book_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reserved_at", sa.Date(), nullable=False, server_default=sa.func.current_date()),
        sa.Column("status", sa.String(20), nullable=False, server_default="WAITING"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"],),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"],),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_book_reservations_status"), "book_reservations", ["status"])

    op.create_table(
        "book_issues",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("copy_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("issued_to", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("issued_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("issue_date", sa.Date(), nullable=False, server_default=sa.func.current_date()),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("returned_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="ISSUED"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["copy_id"], ["book_copies.id"],),
        sa.ForeignKeyConstraint(["issued_by"], ["users.id"],),
        sa.ForeignKeyConstraint(["issued_to"], ["users.id"],),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_book_issues_issued_to"), "book_issues", ["issued_to"])
    op.create_index(op.f("ix_book_issues_status"), "book_issues", ["status"])

    op.create_table(
        "library_fines",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("issue_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("reason", sa.String(100), nullable=False),
        sa.Column("is_paid", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["issue_id"], ["book_issues.id"],),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"],),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_library_fines_user_id"), "library_fines", ["user_id"])

    op.create_table(
        "staff_leaves",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("staff_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("leave_type", sa.String(30), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("reason", sa.String(500), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="PENDING"),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["approved_by"], ["users.id"],),
        sa.ForeignKeyConstraint(["staff_id"], ["users.id"],),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_staff_leaves_staff_id"), "staff_leaves", ["staff_id"])
    op.create_index(op.f("ix_staff_leaves_status"), "staff_leaves", ["status"])

    op.create_table(
        "payroll_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("run_id", sa.String(20), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("is_finalized", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("finalized_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("finalized_at", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["finalized_by"], ["users.id"],),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("run_id"),
    )
    op.create_index(op.f("ix_payroll_runs_run_id"), "payroll_runs", ["run_id"])

    op.create_table(
        "payroll_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("run_id", sa.String(20), nullable=False),
        sa.Column("staff_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("monthly_gross", sa.Numeric(10, 2), nullable=False),
        sa.Column("lop_days", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("lop_deduction", sa.Numeric(10, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("pf_employee", sa.Numeric(10, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("pf_employer", sa.Numeric(10, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("esic", sa.Numeric(10, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("net_pay", sa.Numeric(10, 2), nullable=False),
        sa.Column("is_draft", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["staff_id"], ["users.id"],),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("run_id", "staff_id", name="uq_payroll_run_staff"),
    )
    op.create_index(op.f("ix_payroll_records_run_id"), "payroll_records", ["run_id"])
    op.create_index(op.f("ix_payroll_records_staff_id"), "payroll_records", ["staff_id"])

    op.create_table(
        "salary_slips",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("payroll_record_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("staff_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("pdf_url", sa.String(500), nullable=True),
        sa.Column("generated_at", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["payroll_record_id"], ["payroll_records.id"],),
        sa.ForeignKeyConstraint(["staff_id"], ["users.id"],),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_salary_slips_staff_id"), "salary_slips", ["staff_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_salary_slips_staff_id"), table_name="salary_slips")
    op.drop_table("salary_slips")
    op.drop_index(op.f("ix_payroll_records_staff_id"), table_name="payroll_records")
    op.drop_index(op.f("ix_payroll_records_run_id"), table_name="payroll_records")
    op.drop_table("payroll_records")
    op.drop_index(op.f("ix_payroll_runs_run_id"), table_name="payroll_runs")
    op.drop_table("payroll_runs")
    op.drop_index(op.f("ix_staff_leaves_status"), table_name="staff_leaves")
    op.drop_index(op.f("ix_staff_leaves_staff_id"), table_name="staff_leaves")
    op.drop_table("staff_leaves")
    op.drop_index(op.f("ix_library_fines_user_id"), table_name="library_fines")
    op.drop_table("library_fines")
    op.drop_index(op.f("ix_book_issues_status"), table_name="book_issues")
    op.drop_index(op.f("ix_book_issues_issued_to"), table_name="book_issues")
    op.drop_table("book_issues")
    op.drop_index(op.f("ix_book_reservations_status"), table_name="book_reservations")
    op.drop_table("book_reservations")
    op.drop_index(op.f("ix_book_copies_status"), table_name="book_copies")
    op.drop_table("book_copies")
    op.drop_table("books")
    op.drop_table("book_categories")
