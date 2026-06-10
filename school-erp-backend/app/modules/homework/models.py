import uuid

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base
from app.shared.models import TimestampMixin


class HomeworkAssignment(Base, TimestampMixin):
    __tablename__ = "homework_assignments"

    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    course = Column(String(100), default="")
    course_name = Column(String(200), default="")
    student_group = Column(String(100), default="")
    class_name = Column(String(100), default="")
    academic_year = Column(String(50), default="")
    due_date = Column(Date, nullable=True)
    max_points = Column(Integer, nullable=True)
    assigned_by = Column(String(100), default="")
    assigned_by_name = Column(String(200), default="")
    # New FK columns (migration target)
    section_id = Column(UUID(as_uuid=True), ForeignKey("academic_sections.id", ondelete="SET NULL"), nullable=True, index=True)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("academic_subjects.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("staff_profiles.id", ondelete="SET NULL"), nullable=True)
    assigned_date = Column(Date, server_default=func.current_date(), nullable=False)
    status = Column(String(50), default="Published")
    gc_course_id = Column(String(100), default="")
    gc_course_work_id = Column(String(100), default="")
    gc_invite_code = Column(String(100), default="")
    gc_course_link = Column(String(500), default="")
    sync_status = Column(String(50), default="pending")
    sync_error = Column(Text, nullable=True)
    gc_attempted_at = Column(DateTime(timezone=True), nullable=True)


class HomeworkSubmission(Base, TimestampMixin):
    __tablename__ = "homework_submissions"

    homework_id = Column(UUID(as_uuid=True), ForeignKey("homework_assignments.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    submission_text = Column(Text, nullable=True)
    file_url = Column(String(500), nullable=True)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    status = Column(String(20), nullable=False, default="SUBMITTED")
    marks = Column(Integer, nullable=True)
    graded_by = Column(UUID(as_uuid=True), ForeignKey("staff_profiles.id", ondelete="SET NULL"), nullable=True)
    graded_at = Column(DateTime(timezone=True), nullable=True)
    remarks = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("homework_id", "student_id", name="uq_homework_submission_student"),
    )
