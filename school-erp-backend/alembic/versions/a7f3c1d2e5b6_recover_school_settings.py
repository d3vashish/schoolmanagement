"""recover school_settings table (was dropped by autogenerate in 266413a06b3d)

Idempotent: creates school_settings only if it is missing, so it is a no-op on
fresh installs (where 266413a06b3d no longer drops the table) and repairs
already-migrated databases where the table was dropped.

Revision ID: a7f3c1d2e5b6
Revises: 20260610a
Create Date: 2026-07-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "a7f3c1d2e5b6"
down_revision: Union[str, None] = "20260610a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "school_settings" in inspector.get_table_names():
        return
    op.create_table(
        "school_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("key", sa.String(128), nullable=False),
        sa.Column("value", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_school_settings_key", "school_settings", ["key"], unique=True)


def downgrade() -> None:
    # Non-destructive: leave the table in place on downgrade. school_settings is
    # a base table other code depends on; dropping it is what caused the bug.
    pass
