"""rename teacher_id to instructor_id on timetable_slots

Revision ID: 20260610a
Revises: 8163bde347c8
Create Date: 2026-06-10 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260610a"
down_revision: Union[str, None] = "8163bde347c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("uq_slot_teacher_day_period", "timetable_slots", type_="unique")
    op.drop_constraint("timetable_slots_teacher_id_fkey", "timetable_slots", type_="foreignkey")
    op.alter_column("timetable_slots", "teacher_id", new_column_name="instructor_id")

    op.execute("""
        UPDATE timetable_slots
        SET instructor_id = sp.id
        FROM staff_profiles sp
        WHERE timetable_slots.instructor_id = sp.user_id
    """)

    op.execute("""
        UPDATE timetable_slots
        SET instructor_id = NULL
        WHERE instructor_id IS NOT NULL
        AND instructor_id NOT IN (SELECT id FROM staff_profiles)
    """)

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

    op.execute("""
        UPDATE timetable_slots
        SET instructor_id = sp.user_id
        FROM staff_profiles sp
        WHERE timetable_slots.instructor_id = sp.id
    """)

    op.execute("""
        UPDATE timetable_slots
        SET instructor_id = NULL
        WHERE instructor_id IS NOT NULL
        AND instructor_id NOT IN (SELECT id FROM users)
    """)

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
