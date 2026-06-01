from sqlalchemy import Boolean, Column, Date, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base
from app.shared.models import TimestampMixin


class StaffLeave(Base, TimestampMixin):
    __tablename__ = "staff_leaves"

    staff_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    leave_type = Column(String(30), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    reason = Column(String(500), nullable=True)
    status = Column(String(20), nullable=False, default="PENDING", index=True)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)


class PayrollRun(Base, TimestampMixin):
    __tablename__ = "payroll_runs"

    run_id = Column(String(20), nullable=False, index=True)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    is_finalized = Column(Boolean, default=False, nullable=False)
    finalized_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    finalized_at = Column(Date, nullable=True)

    __table_args__ = (
        UniqueConstraint("run_id", name="uq_payroll_run_id"),
    )


class PayrollRecord(Base, TimestampMixin):
    __tablename__ = "payroll_records"

    run_id = Column(String(20), nullable=False, index=True)
    staff_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    monthly_gross = Column(Numeric(10, 2), nullable=False)
    lop_days = Column(Integer, nullable=False, default=0)
    lop_deduction = Column(Numeric(10, 2), nullable=False, default=0)
    pf_employee = Column(Numeric(10, 2), nullable=False, default=0)
    pf_employer = Column(Numeric(10, 2), nullable=False, default=0)
    esic = Column(Numeric(10, 2), nullable=False, default=0)
    net_pay = Column(Numeric(10, 2), nullable=False)
    is_draft = Column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("run_id", "staff_id", name="uq_payroll_run_staff"),
    )


class SalarySlip(Base, TimestampMixin):
    __tablename__ = "salary_slips"

    payroll_record_id = Column(UUID(as_uuid=True), ForeignKey("payroll_records.id"), nullable=False)
    staff_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    pdf_url = Column(String(500), nullable=True)
    generated_at = Column(Date, nullable=True)
