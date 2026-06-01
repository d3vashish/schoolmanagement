"""report_cards_and_academic_progressions

Revision ID: 2adc41ef0a85
Revises: 8787f8aaf831
Create Date: 2026-05-27 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "2adc41ef0a85"
down_revision: Union[str, None] = "8787f8aaf831"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "report_cards",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("exam_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("file_url", sa.String(500), nullable=False),
        sa.Column("generated_at", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["exam_id"], ["exams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["student_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("exam_id", "student_id", name="uq_report_card_exam_student"),
    )

    op.create_table(
        "academic_progressions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("from_class_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("to_class_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("from_academic_year_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("to_academic_year_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_retained", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("promoted_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("promoted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["student_profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["from_class_id"], ["academic_classes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["to_class_id"], ["academic_classes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["from_academic_year_id"], ["academic_years.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["to_academic_year_id"], ["academic_years.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["promoted_by"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("academic_progressions")
    op.drop_table("report_cards")
