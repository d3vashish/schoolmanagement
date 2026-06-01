from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base
from app.shared.models import TimestampMixin


class ParentStudentLink(Base, TimestampMixin):
    __tablename__ = "parent_student_links"

    parent_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("student_profiles.id"), nullable=False, index=True)
    relationship = Column(String(50), nullable=True)

    __table_args__ = (
        UniqueConstraint("parent_id", "student_id", name="uq_parent_student_link"),
    )


class Circular(Base, TimestampMixin):
    __tablename__ = "circulars"

    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=False)
    attachment_url = Column(String(500), nullable=True)
    target_class_id = Column(UUID(as_uuid=True), ForeignKey("academic_classes.id"), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    published_at = Column(DateTime(timezone=True), nullable=True)


class TeacherMessage(Base, TimestampMixin):
    __tablename__ = "teacher_messages"

    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    receiver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("student_profiles.id"), nullable=True)
    subject = Column(String(200), nullable=False)
    body = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    read_at = Column(DateTime(timezone=True), nullable=True)


class UserNotificationPref(Base, TimestampMixin):
    __tablename__ = "user_notification_prefs"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True)
    sms_enabled = Column(Boolean, default=True, nullable=False)
    email_enabled = Column(Boolean, default=True, nullable=False)
    push_enabled = Column(Boolean, default=True, nullable=False)
