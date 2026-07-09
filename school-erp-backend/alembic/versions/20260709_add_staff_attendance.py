"""add staff_attendance table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "staff_attendance",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("staff_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=10), nullable=False),
        sa.Column("marked_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("remarks", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["staff_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["marked_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("staff_id", "date", name="uq_staff_attendance_staff_date"),
    )
    op.create_index("ix_staff_attendance_staff_id", "staff_attendance", ["staff_id"])
    op.create_index("ix_staff_attendance_date", "staff_attendance", ["date"])


def downgrade() -> None:
    op.drop_index("ix_staff_attendance_date", table_name="staff_attendance")
    op.drop_index("ix_staff_attendance_staff_id", table_name="staff_attendance")
    op.drop_table("staff_attendance")
