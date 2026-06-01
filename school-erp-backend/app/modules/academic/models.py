from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.shared.models import TimestampMixin


class AcademicYear(Base, TimestampMixin):
    __tablename__ = "academic_years"

    name = Column(String(20), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    is_active = Column(Boolean, default=False, nullable=False)


class Class(Base, TimestampMixin):
    __tablename__ = "academic_classes"

    name = Column(String(50), nullable=False)
    order = Column(Integer, nullable=False)

    sections = relationship("Section", back_populates="class_")


class Section(Base, TimestampMixin):
    __tablename__ = "academic_sections"

    class_id = Column(UUID(as_uuid=True), ForeignKey("academic_classes.id"), nullable=False)
    name = Column(String(10), nullable=False)
    capacity = Column(Integer, nullable=False)
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False)
    class_teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    class_ = relationship("Class", back_populates="sections")
    academic_year = relationship("AcademicYear")


class Subject(Base, TimestampMixin):
    __tablename__ = "academic_subjects"

    name = Column(String(100), nullable=False)
    code = Column(String(20), unique=True, nullable=False)
    is_graded = Column(Boolean, default=True, nullable=False)


class ClassSubject(Base, TimestampMixin):
    __tablename__ = "class_subjects"

    class_id = Column(UUID(as_uuid=True), ForeignKey("academic_classes.id"), nullable=False)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("academic_subjects.id"), nullable=False)


class Holiday(Base, TimestampMixin):
    __tablename__ = "holidays"

    date = Column(Date, nullable=False, unique=True, index=True)
    name = Column(String(200), nullable=False)
    holiday_type = Column(String(20), nullable=False)


class AcademicProgression(Base, TimestampMixin):
    __tablename__ = "academic_progressions"

    student_id = Column(UUID(as_uuid=True), ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False)
    from_class_id = Column(UUID(as_uuid=True), ForeignKey("academic_classes.id", ondelete="CASCADE"), nullable=False)
    to_class_id = Column(UUID(as_uuid=True), ForeignKey("academic_classes.id", ondelete="CASCADE"), nullable=False)
    from_academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id", ondelete="CASCADE"), nullable=False)
    to_academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id", ondelete="CASCADE"), nullable=False)
    is_retained = Column(Boolean, default=False, nullable=False)
    promoted_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    promoted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class TeacherAssignment(Base, TimestampMixin):
    __tablename__ = "teacher_assignments"

    instructor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    section_id = Column(UUID(as_uuid=True), ForeignKey("academic_sections.id"), nullable=False, index=True)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("academic_subjects.id"), nullable=False, index=True)
    class_id = Column(UUID(as_uuid=True), ForeignKey("academic_classes.id"), nullable=False)

    __table_args__ = (
        UniqueConstraint("instructor_id", "section_id", "subject_id", name="uq_teacher_assignment"),
    )
