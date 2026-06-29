from sqlalchemy import Column, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base
from app.shared.models import TimestampMixin

# A notification targets exactly one of: a specific user, a role, or a section.
# target_type discriminates which column is meaningful.
TARGET_USER = "USER"
TARGET_ROLE = "ROLE"
TARGET_SECTION = "SECTION"

NOTIFICATION_TARGET_TYPES = (TARGET_USER, TARGET_ROLE, TARGET_SECTION)


class Notification(Base, TimestampMixin):
    __tablename__ = "notifications"

    title = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(30), nullable=False, default="GENERAL")  # e.g. ATTENDANCE, FEES, LEAVE, GENERAL
    link = Column(String(255), nullable=True)  # optional frontend route, e.g. /fees/invoice123

    target_type = Column(String(10), nullable=False, default=TARGET_USER, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    role = Column(String(20), nullable=True, index=True)
    section_id = Column(UUID(as_uuid=True), ForeignKey("academic_sections.id", ondelete="CASCADE"), nullable=True, index=True)

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)


class NotificationRead(Base, TimestampMixin):
    """Per-user read-state. A row's existence means that user has read that notification.

    Needed because USER-targeted notifications have one implicit recipient, but
    ROLE/SECTION-targeted notifications are read independently by each recipient.
    """

    __tablename__ = "notification_reads"

    notification_id = Column(UUID(as_uuid=True), ForeignKey("notifications.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    __table_args__ = (
        UniqueConstraint("notification_id", "user_id", name="uq_notification_read_user"),
    )