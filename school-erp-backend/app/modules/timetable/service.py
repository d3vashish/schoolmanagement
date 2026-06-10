from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.timetable.models import TimetableSlot


async def check_conflicts(
    section_id: str,
    instructor_id: str,
    day_of_week: int,
    period_no: int,
    academic_year_id: str,
    exclude_slot_id: str | None,
    db: AsyncSession,
) -> None:
    section_conflict = await db.execute(
        select(TimetableSlot).where(
            TimetableSlot.section_id == section_id,
            TimetableSlot.day_of_week == day_of_week,
            TimetableSlot.period_no == period_no,
        )
    )
    existing_section_slot = section_conflict.scalar_one_or_none()
    if existing_section_slot and str(existing_section_slot.id) != (exclude_slot_id or ""):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Section already has a class in this time slot",
        )

    teacher_conflict = await db.execute(
        select(TimetableSlot).where(
            TimetableSlot.instructor_id == instructor_id,
            TimetableSlot.day_of_week == day_of_week,
            TimetableSlot.period_no == period_no,
            TimetableSlot.academic_year_id == academic_year_id,
        )
    )
    existing_teacher_slot = teacher_conflict.scalar_one_or_none()
    if existing_teacher_slot and str(existing_teacher_slot.id) != (exclude_slot_id or ""):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Teacher already assigned to another section in this period",
        )


async def create_slot(data: dict, db: AsyncSession) -> TimetableSlot:
    await check_conflicts(
        section_id=data["section_id"],
        instructor_id=data["instructor_id"],
        day_of_week=data["day_of_week"],
        period_no=data["period_no"],
        academic_year_id=data["academic_year_id"],
        exclude_slot_id=None,
        db=db,
    )
    slot = TimetableSlot(**data)
    db.add(slot)
    await db.flush()
    return slot


async def update_slot(slot_id: str, data: dict, db: AsyncSession) -> TimetableSlot:
    slot = await db.get(TimetableSlot, slot_id)
    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slot not found")

    await check_conflicts(
        section_id=data.get("section_id", str(slot.section_id)),
        instructor_id=data.get("instructor_id", str(slot.instructor_id)),
        day_of_week=data.get("day_of_week", slot.day_of_week),
        period_no=data.get("period_no", slot.period_no),
        academic_year_id=data.get("academic_year_id", str(slot.academic_year_id)),
        exclude_slot_id=slot_id,
        db=db,
    )
    for key, value in data.items():
        setattr(slot, key, value)
    await db.flush()
    return slot
