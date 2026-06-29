"""add_notifications_tables

Revision ID: 652b8d2ab0fd
Revises: 4289407dc7c3
Create Date: 2026-06-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "652b8d2ab0fd"
down_revision: Union[str, None] = "4289407dc7c3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(150), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("type", sa.String(30), nullable=False, server_default="GENERAL"),
        sa.Column("link", sa.String(255), nullable=True),
        sa.Column("target_type", sa.String(10), nullable=False, server_default="USER"),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("role", sa.String(20), nullable=True),
        sa.Column("section_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"],),
        sa.ForeignKeyConstraint(["section_id"], ["academic_sections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"],),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notifications_target_type"), "notifications", ["target_type"])
    op.create_index(op.f("ix_notifications_user_id"), "notifications", ["user_id"])
    op.create_index(op.f("ix_notifications_role"), "notifications", ["role"])
    op.create_index(op.f("ix_notifications_section_id"), "notifications", ["section_id"])

    op.create_table(
        "notification_reads",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("notification_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["notification_id"], ["notifications.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"],),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("notification_id", "user_id", name="uq_notification_read_user"),
    )
    op.create_index(op.f("ix_notification_reads_notification_id"), "notification_reads", ["notification_id"])
    op.create_index(op.f("ix_notification_reads_user_id"), "notification_reads", ["user_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_notification_reads_user_id"), table_name="notification_reads")
    op.drop_index(op.f("ix_notification_reads_notification_id"), table_name="notification_reads")
    op.drop_table("notification_reads")
    op.drop_index(op.f("ix_notifications_section_id"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_role"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_user_id"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_target_type"), table_name="notifications")
    op.drop_table("notifications")