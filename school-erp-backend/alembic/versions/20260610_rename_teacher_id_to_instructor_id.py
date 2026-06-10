"""rename teacher_id to instructor_id on timetable_slots

Revision ID: 20260610_rename_teacher_id_to_instructor_id
Revises: 7894d2594234
Create Date: 2026-06-10 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260610_rename_teacher_id_to_instructor_id"
down_revision: Union[str, None] = "7894d2594234"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("uq_slot_teacher_day_period", "timetable_slots", type_="unique")
    op.drop_constraint("timetable_slots_teacher_id_fkey", "timetable_slots", type_="foreignkey")
    op.alter_column("timetable_slots", "teacher_id", new_column_name="instructor_id")
    op.create_foreign_key(
        "timetable_slots_instructor_id_fkey",
        "timetable_slots",
        "staff_profiles",
        ["instructor_id"],
        ["id"],
    )
    op.create_unique_constraint(
        "uq_slot_instructor_day_period",
        "timetable_slots",
        ["instructor_id", "day_of_week", "period_no", "academic_year_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_slot_instructor_day_period", "timetable_slots", type_="unique")
    op.drop_constraint("timetable_slots_instructor_id_fkey", "timetable_slots", type_="foreignkey")
    op.alter_column("timetable_slots", "instructor_id", new_column_name="teacher_id")
    op.create_foreign_key(
        "timetable_slots_teacher_id_fkey",
        "timetable_slots",
        "users",
        ["teacher_id"],
        ["id"],
    )
    op.create_unique_constraint(
        "uq_slot_teacher_day_period",
        "timetable_slots",
        ["teacher_id", "day_of_week", "period_no", "academic_year_id"],
    )
