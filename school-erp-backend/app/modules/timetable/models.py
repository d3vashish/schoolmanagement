from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base
from app.shared.models import TimestampMixin


class TimetableSlot(Base, TimestampMixin):
    __tablename__ = "timetable_slots"

    section_id = Column(UUID(as_uuid=True), ForeignKey("academic_sections.id"), nullable=False)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("academic_subjects.id"), nullable=False)
    instructor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    day_of_week = Column(Integer, nullable=False)
    period_no = Column(Integer, nullable=False)
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False)
    is_published = Column(Boolean, default=False, nullable=False)

    __table_args__ = (
        UniqueConstraint("section_id", "day_of_week", "period_no", name="uq_slot_section_day_period"),
        UniqueConstraint("instructor_id", "day_of_week", "period_no", "academic_year_id", name="uq_slot_instructor_day_period"),
    )
