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

    fee_head = relationship("FeeHead")
    installments = relationship("FeeInstallment", back_populates="structure")


class FeeInstallment(Base, TimestampMixin):
    __tablename__ = "fee_installments"

    structure_id = Column(UUID(as_uuid=True), ForeignKey("fee_structures.id"), nullable=False)
    name = Column(String(100), nullable=False)
    due_date = Column(Date, nullable=False)
    percent = Column(Integer, nullable=False)

    structure = relationship("FeeStructure", back_populates="installments")


class LateFeeRule(Base, TimestampMixin):
    __tablename__ = "late_fee_rules"

    structure_id = Column(UUID(as_uuid=True), ForeignKey("fee_structures.id"), nullable=False)
    amount_per_day = Column(Numeric(10, 2), nullable=False)
    max_amount = Column(Numeric(10, 2), nullable=True)


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


class Invoice(Base, TimestampMixin):
    __tablename__ = "invoices"

    student_id = Column(UUID(as_uuid=True), ForeignKey("student_profiles.id"), nullable=False, index=True)
    section_id = Column(UUID(as_uuid=True), ForeignKey("academic_sections.id", ondelete="SET NULL"), nullable=True, index=True)
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id", ondelete="SET NULL"), nullable=True, index=True)
    installment_id = Column(UUID(as_uuid=True), ForeignKey("fee_installments.id"), nullable=False)
    gross_amount = Column(Numeric(10, 2), nullable=False)
    discount_amount = Column(Numeric(10, 2), nullable=False)
    net_amount = Column(Numeric(10, 2), nullable=False)
    paid_amount = Column(Numeric(10, 2), default=0)
    due_date = Column(Date, nullable=False)
    status = Column(String(20), nullable=False, default="PENDING", index=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    late_fee_per_day = Column(Numeric(10, 2), nullable=False, default=0)
    late_fee_max = Column(Numeric(10, 2), nullable=True)
    razorpay_order_id = Column(String(100), nullable=True)
    razorpay_payment_id = Column(String(100), nullable=True)
    receipt_url = Column(Text, nullable=True)


class Payment(Base, TimestampMixin):
    __tablename__ = "payments"

    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    mode = Column(String(20), nullable=False)
    reference_no = Column(String(100), nullable=True)
    received_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    notes = Column(Text, nullable=True)


class JournalEntry(Base, TimestampMixin):
    __tablename__ = "journal_entries"

    student_id = Column(UUID(as_uuid=True), ForeignKey("student_profiles.id"), nullable=False)
    description = Column(Text, nullable=False)
    debit_amount = Column(Numeric(10, 2), default=0)
    credit_amount = Column(Numeric(10, 2), default=0)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    status = Column(String(20), default="PENDING")


class PaymentOrder(Base, TimestampMixin):
    __tablename__ = "payment_orders"

    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False)
    razorpay_order_id = Column(String(100), unique=True, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    status = Column(String(20), nullable=False, default="CREATED")
