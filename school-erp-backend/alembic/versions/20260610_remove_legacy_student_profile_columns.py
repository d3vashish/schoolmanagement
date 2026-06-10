"""remove legacy student_profile columns (class_id, section_id, roll_number)

Revision ID: 20260610
Revises: 20260609
Create Date: 2026-06-10 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260610"
down_revision: Union[str, None] = "20260609"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("student_profiles_section_id_fkey", "student_profiles", type_="foreignkey")
    op.drop_column("student_profiles", "roll_number")
    op.drop_column("student_profiles", "section_id")
    op.drop_column("student_profiles", "class_id")


def downgrade() -> None:
    op.add_column("student_profiles", sa.Column("class_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("student_profiles", sa.Column("section_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("student_profiles", sa.Column("roll_number", sa.String(20), nullable=True))
    op.create_foreign_key("student_profiles_section_id_fkey", "student_profiles", "academic_sections", ["section_id"], ["id"])
