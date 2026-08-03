"""add_aadhar_number_to_students

Revision ID: 4244403edc06
Revises: 37d01b5ecba4
Create Date: 2026-06-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "4244403edc06"
down_revision: Union[str, None] = "37d01b5ecba4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable at the DB level so existing students (created before this
    # field existed) don't break. The "required" rule is enforced at the
    # Pydantic schema / form level for NEW students going forward. Existing
    # students will need their Aadhar backfilled via Edit before their
    # admission_number can be regenerated in the new format.
    op.add_column("student_profiles", sa.Column("aadhar_number", sa.String(12), nullable=True))


def downgrade() -> None:
    op.drop_column("student_profiles", "aadhar_number")