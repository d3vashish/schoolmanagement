from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.shared.models import TimestampMixin


class FeeHead(Base, TimestampMixin):
    __tablename__ = "fee_heads"

    name = Column(String(100), nullable=False)
    is_taxable = Column(Boolean, default=False, nullable=False)
    tax_percent = Column(Numeric(5, 2), default=0, nullable=False)


class FeeStructure(Base, TimestampMixin):
    __tablename__ = "fee_structures"

    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False)
    class_id = Column(UUID(as_uuid=True), ForeignKey("academic_classes.id"), nullable=False)
    fee_head_id = Column(UUID(as_uuid=True), ForeignKey("fee_heads.id"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    # True = this row's amount applies to newly-admitted students (first enrollment
    # falls in the current academic year). False = applies to continuing/old students.
    # Two FeeStructure rows per class (one True, one False) cover the old/new split.
    is_new_student = Column(Boolean, nullable=False, default=False, server_default="false")

    fee_head = relationship("FeeHead")
    installments = relationship(
        "FeeInstallment", back_populates="structure", cascade="all, delete-orphan"
    )


class FeeInstallment(Base, TimestampMixin):
    """
    One installment/term within a Fee Structure, e.g. "Term 1" due 31-03-2026
    for 40% of the structure's total amount. A structure's installments must
    add up to 100% (enforced in the API layer, not the DB) so the UI can
    show a running "X% of 100%" total while the admin builds them out.
    """
    __tablename__ = "fee_installments"

    structure_id = Column(UUID(as_uuid=True), ForeignKey("fee_structures.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(50), nullable=False)
    due_date = Column(Date, nullable=False)
    percent = Column(Numeric(5, 2), nullable=False)

    structure = relationship("FeeStructure", back_populates="installments")


class StudentDiscount(Base, TimestampMixin):
    __tablename__ = "student_discounts"

    student_id = Column(UUID(as_uuid=True), ForeignKey("student_profiles.id"), nullable=False)
    discount_type = Column(String(30), nullable=False)
    percentage = Column(Numeric(5, 2), nullable=True)
    flat_amount = Column(Numeric(10, 2), nullable=True)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    valid_until = Column(Date, nullable=True)
    reason = Column(Text, nullable=True)


class StudentLedgerEntry(Base, TimestampMixin):
    __tablename__ = "student_ledger_entries"

    student_id = Column(UUID(as_uuid=True), ForeignKey("student_profiles.id"), nullable=False, index=True)
    entry_type = Column(String(20), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    ref_type = Column(String(30), nullable=False)
    ref_id = Column(UUID(as_uuid=True), nullable=True)
    description = Column(Text, nullable=True)
    running_balance = Column(Numeric(10, 2), nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)


class FeeReceipt(Base, TimestampMixin):
    """
    A single payment made by a student, recorded by an accountant. There is
    no Invoice anymore - what a student owes is computed on the fly from
    FeeStructure (see service.get_student_fee_summary), and what they've
    paid is the sum of their FeeReceipt rows for that academic year.
    Each receipt is printable and individually numbered.
    """
    __tablename__ = "fee_receipts"

    receipt_number = Column(String(30), unique=True, nullable=False, index=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("student_profiles.id"), nullable=False, index=True)
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False, index=True)
    amount = Column(Numeric(10, 2), nullable=False)
    mode = Column(String(20), nullable=False)
    reference_no = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    received_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)


class JournalEntry(Base, TimestampMixin):
    __tablename__ = "journal_entries"

    student_id = Column(UUID(as_uuid=True), ForeignKey("student_profiles.id"), nullable=False)
    description = Column(Text, nullable=False)
    debit_amount = Column(Numeric(10, 2), default=0, nullable=False)
    credit_amount = Column(Numeric(10, 2), default=0, nullable=False)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    status = Column(String(20), default="PENDING")