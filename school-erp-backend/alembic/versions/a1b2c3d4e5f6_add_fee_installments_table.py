"""add fee_installments table

Revision ID: a1b2c3d4e5f6
Revises: <PUT_YOUR_CURRENT_HEAD_REVISION_HERE>
Create Date: 2026-07-08

IMPORTANT: before running this, open a terminal in school-erp-backend and run:

    alembic heads

That will print the actual current head revision id. Replace the
<PUT_YOUR_CURRENT_HEAD_REVISION_HERE> placeholder below with that value,
otherwise Alembic won't know this migration comes after your existing ones.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "4244403edc06"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "fee_installments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("structure_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("percent", sa.Numeric(5, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["structure_id"], ["fee_structures.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_fee_installments_structure_id", "fee_installments", ["structure_id"])


def downgrade() -> None:
    op.drop_index("ix_fee_installments_structure_id", table_name="fee_installments")
    op.drop_table("fee_installments")