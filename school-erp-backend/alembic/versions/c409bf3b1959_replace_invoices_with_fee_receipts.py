"""replace_invoices_with_fee_receipts

Revision ID: c409bf3b1959
Revises: 652b8d2ab0fd
Create Date: 2026-06-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "c409bf3b1959"
down_revision: Union[str, None] = "652b8d2ab0fd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop tables in dependency order: children before parents.
    # payments -> invoices, payment_orders -> invoices, invoices -> fee_installments,
    # late_fee_rules -> fee_structures, fee_installments -> fee_structures
    op.drop_table("payments")
    op.drop_table("payment_orders")
    op.drop_table("invoices")
    op.drop_table("late_fee_rules")
    op.drop_table("fee_installments")

    op.create_table(
        "fee_receipts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("receipt_number", sa.String(30), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("academic_year_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("mode", sa.String(20), nullable=False),
        sa.Column("reference_no", sa.String(100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("received_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["student_profiles.id"],),
        sa.ForeignKeyConstraint(["academic_year_id"], ["academic_years.id"],),
        sa.ForeignKeyConstraint(["received_by"], ["users.id"],),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("receipt_number"),
    )
    op.create_index(op.f("ix_fee_receipts_receipt_number"), "fee_receipts", ["receipt_number"])
    op.create_index(op.f("ix_fee_receipts_student_id"), "fee_receipts", ["student_id"])
    op.create_index(op.f("ix_fee_receipts_academic_year_id"), "fee_receipts", ["academic_year_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_fee_receipts_academic_year_id"), table_name="fee_receipts")
    op.drop_index(op.f("ix_fee_receipts_student_id"), table_name="fee_receipts")
    op.drop_index(op.f("ix_fee_receipts_receipt_number"), table_name="fee_receipts")
    op.drop_table("fee_receipts")

    op.create_table(
        "fee_installments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("structure_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("percent", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["structure_id"], ["fee_structures.id"],),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "late_fee_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("structure_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("amount_per_day", sa.Numeric(10, 2), nullable=False),
        sa.Column("max_amount", sa.Numeric(10, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["structure_id"], ["fee_structures.id"],),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "invoices",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("section_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("academic_year_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("installment_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("gross_amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("discount_amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("net_amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("paid_amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("late_fee_per_day", sa.Numeric(10, 2), nullable=False),
        sa.Column("late_fee_max", sa.Numeric(10, 2), nullable=True),
        sa.Column("razorpay_order_id", sa.String(100), nullable=True),
        sa.Column("razorpay_payment_id", sa.String(100), nullable=True),
        sa.Column("receipt_url", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["student_profiles.id"],),
        sa.ForeignKeyConstraint(["section_id"], ["academic_sections.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["academic_year_id"], ["academic_years.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["installment_id"], ["fee_installments.id"],),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "payment_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("razorpay_order_id", sa.String(100), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"],),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("razorpay_order_id"),
    )

    op.create_table(
        "payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("mode", sa.String(20), nullable=False),
        sa.Column("reference_no", sa.String(100), nullable=True),
        sa.Column("received_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"],),
        sa.ForeignKeyConstraint(["received_by"], ["users.id"],),
        sa.PrimaryKeyConstraint("id"),
    )