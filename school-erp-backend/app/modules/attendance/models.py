from sqlalchemy import Boolean, Column, Date, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base
from app.shared.models import TimestampMixin


class Attendance(Base, TimestampMixin):
    __tablename__ = "attendance"

    student_id = Column(UUID(as_uuid=True), ForeignKey("student_profiles.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    period_no = Column(Integer, nullable=True)
    status = Column(String(10), nullable=False)
    marked_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    is_corrected = Column(Boolean, default=False, nullable=False)
    corrected_by = Column(UUID(as_uuid=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("student_id", "date", "period_no", name="uq_attendance_student_date_period"),
    )


class LeaveType(Base, TimestampMixin):
    __tablename__ = "leave_types"

    name = Column(String(50), nullable=False)
    is_paid = Column(Boolean, default=True, nullable=False)


class LeaveApplication(Base, TimestampMixin):
    __tablename__ = "leave_applications"

    student_id = Column(UUID(as_uuid=True), ForeignKey("student_profiles.id"), nullable=False, index=True)
    leave_type_id = Column(UUID(as_uuid=True), ForeignKey("leave_types.id"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    reason = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="PENDING", index=True)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at = Column(Date, nullable=True)
