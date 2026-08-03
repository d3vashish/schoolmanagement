from sqlalchemy import Column, Date, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base
from app.shared.models import TimestampMixin


class ClassTest(Base, TimestampMixin):
    __tablename__ = "class_tests"

    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    section_id = Column(UUID(as_uuid=True), ForeignKey("academic_sections.id", ondelete="CASCADE"), nullable=False, index=True)
    test_date = Column(Date, nullable=True)
    max_marks = Column(Numeric(6, 2), nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)


class ClassTestMark(Base, TimestampMixin):
    """
    One row per (test, student). marks_obtained is nullable - a missing row,
    or a row with marks_obtained = NULL, both mean "not yet entered" (distinct
    from 0, which means the student scored zero).
    """
    __tablename__ = "class_test_marks"

    test_id = Column(UUID(as_uuid=True), ForeignKey("class_tests.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    marks_obtained = Column(Numeric(6, 2), nullable=True)

    __table_args__ = (
        UniqueConstraint("test_id", "student_id", name="uq_class_test_mark_student"),
    )