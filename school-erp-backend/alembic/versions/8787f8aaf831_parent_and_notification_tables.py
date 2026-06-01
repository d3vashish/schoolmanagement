"""parent_and_notification_tables

Revision ID: 8787f8aaf831
Revises: ebb125adc676
Create Date: 2026-05-27 12:36:57.370301

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "8787f8aaf831"
down_revision: Union[str, None] = "ebb125adc676"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "parent_student_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("relationship", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["parent_id"], ["users.id"],),
        sa.ForeignKeyConstraint(["student_id"], ["student_profiles.id"],),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("parent_id", "student_id", name="uq_parent_student_link"),
    )
    op.create_index(op.f("ix_parent_student_links_parent_id"), "parent_student_links", ["parent_id"])
    op.create_index(op.f("ix_parent_student_links_student_id"), "parent_student_links", ["student_id"])

    op.create_table(
        "circulars",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("attachment_url", sa.String(500), nullable=True),
        sa.Column("target_class_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"],),
        sa.ForeignKeyConstraint(["target_class_id"], ["academic_classes.id"],),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "teacher_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sender_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("receiver_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("subject", sa.String(200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("is_read", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["receiver_id"], ["users.id"],),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"],),
        sa.ForeignKeyConstraint(["student_id"], ["student_profiles.id"],),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_teacher_messages_sender_id"), "teacher_messages", ["sender_id"])
    op.create_index(op.f("ix_teacher_messages_receiver_id"), "teacher_messages", ["receiver_id"])

    op.create_table(
        "user_notification_prefs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sms_enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("email_enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("push_enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"],),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )


def downgrade() -> None:
    op.drop_table("user_notification_prefs")
    op.drop_index(op.f("ix_teacher_messages_receiver_id"), table_name="teacher_messages")
    op.drop_index(op.f("ix_teacher_messages_sender_id"), table_name="teacher_messages")
    op.drop_table("teacher_messages")
    op.drop_table("circulars")
    op.drop_index(op.f("ix_parent_student_links_student_id"), table_name="parent_student_links")
    op.drop_index(op.f("ix_parent_student_links_parent_id"), table_name="parent_student_links")
    op.drop_table("parent_student_links")
