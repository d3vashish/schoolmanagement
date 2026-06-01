"""admissions_tables

Revision ID: 72b391f8b7d6
Revises: 5a3e6665e689
Create Date: 2026-05-27 12:52:30.828433

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "72b391f8b7d6"
down_revision: Union[str, None] = "5a3e6665e689"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "admissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("applicant_name", sa.String(200), nullable=False),
        sa.Column("applicant_phone", sa.String(20), nullable=False),
        sa.Column("applicant_email", sa.String(255), nullable=True),
        sa.Column("date_of_birth", sa.DateTime(timezone=True), nullable=True),
        sa.Column("class_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("academic_year_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="INQUIRY"),
        sa.Column("parent_name", sa.String(200), nullable=True),
        sa.Column("parent_phone", sa.String(20), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("previous_school", sa.String(200), nullable=True),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["academic_year_id"], ["academic_years.id"],),
        sa.ForeignKeyConstraint(["class_id"], ["academic_classes.id"],),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_admissions_status"), "admissions", ["status"])

    op.create_table(
        "admission_documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("admission_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("doc_type", sa.String(50), nullable=False),
        sa.Column("file_key", sa.String(500), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="PENDING"),
        sa.Column("verified_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["admission_id"], ["admissions.id"],),
        sa.ForeignKeyConstraint(["verified_by"], ["users.id"],),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("admission_documents")
    op.drop_index(op.f("ix_admissions_status"), table_name="admissions")
    op.drop_table("admissions")
