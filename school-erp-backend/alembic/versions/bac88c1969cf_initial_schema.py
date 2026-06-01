"""initial_schema

Revision ID: bac88c1969cf
Revises: 
Create Date: 2026-05-27 12:43:32.561098

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bac88c1969cf'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("table_name", sa.String(128), nullable=False),
        sa.Column("record_id", sa.UUID(), nullable=False),
        sa.Column("action", sa.String(16), nullable=False),
        sa.Column("changed_by", sa.UUID(), nullable=True),
        sa.Column("old_values", sa.JSON(), nullable=True),
        sa.Column("new_values", sa.JSON(), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.func.now(), nullable=False,
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            server_default=sa.func.now(), nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audit_logs_table_name"), "audit_logs", ["table_name"])
    op.create_index(op.f("ix_audit_logs_record_id"), "audit_logs", ["record_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_audit_logs_record_id"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_table_name"), table_name="audit_logs")
    op.drop_table("audit_logs")
