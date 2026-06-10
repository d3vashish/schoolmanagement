from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.core.database import get_db
from app.core.deps import QueryScoper, get_current_user, role_required
from app.modules.academic.models import Subject
from app.modules.auth.models import StaffProfile
from app.modules.timetable.models import TimetableSlot
from app.modules.timetable.schemas import TimetableSlotCreate, TimetableSlotResponse
from app.modules.timetable.service import create_slot, update_slot

admin_only = [role_required("super_admin", "principal")]

router = APIRouter(prefix="/timetable", tags=["timetable"])


def _build_slots_query():
    """Build a base query that joins teacher name and subject name."""
    return (
        select(
            TimetableSlot,
            (StaffProfile.first_name + " " + StaffProfile.last_name).label("teacher_name"),
            Subject.name.label("subject_name"),
        )
        .outerjoin(StaffProfile, StaffProfile.user_id == TimetableSlot.teacher_id)
        .outerjoin(Subject, Subject.id == TimetableSlot.subject_id)
    )


def _row_to_response(row) -> dict:
    """Convert a joined query row into a TimetableSlotResponse-compatible dict."""
    slot = row[0]
    return {
        "id": slot.id,
        "section_id": slot.section_id,
        "subject_id": slot.subject_id,
        "teacher_id": slot.teacher_id,
        "day_of_week": slot.day_of_week,
        "period_no": slot.period_no,
        "academic_year_id": slot.academic_year_id,
        "is_published": slot.is_published,
        "teacher_name": row.teacher_name,
        "subject_name": row.subject_name,
    }


@router.get("/slots", response_model=list[TimetableSlotResponse])
async def list_slots(
    section_id: str | None = None,
    teacher_id: str | None = None,
    day_of_week: int | None = None,
    schedule_date: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    q = _build_slots_query()

    scope = QueryScoper.for_timetable_slots(db, current_user)
    if scope is not None:
        q = q.where(scope)

    if section_id:
        q = q.where(TimetableSlot.section_id == section_id)
    if teacher_id:
        q = q.where(TimetableSlot.teacher_id == teacher_id)
    if day_of_week is not None:
        q = q.where(TimetableSlot.day_of_week == day_of_week)
    if schedule_date:
        from datetime import datetime
        try:
            dt = datetime.strptime(schedule_date, "%Y-%m-%d")
            q = q.where(TimetableSlot.day_of_week == dt.weekday())
        except ValueError:
            pass
    q = q.order_by(TimetableSlot.day_of_week, TimetableSlot.period_no)
    result = await db.execute(q)
    rows = result.all()
    return [_row_to_response(row) for row in rows]


@router.post("/slots", response_model=TimetableSlotResponse, dependencies=admin_only)
async def create_timetable_slot(body: TimetableSlotCreate, db: AsyncSession = Depends(get_db)):
    slot = await create_slot(body.model_dump(), db)
    # Re-fetch with joins to include names
    q = _build_slots_query().where(TimetableSlot.id == slot.id)
    result = await db.execute(q)
    row = result.first()
    return _row_to_response(row)


@router.get("/slots/{slot_id}", response_model=TimetableSlotResponse)
async def get_slot(slot_id: str, db: AsyncSession = Depends(get_db)):
    q = _build_slots_query().where(TimetableSlot.id == slot_id)
    result = await db.execute(q)
    row = result.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slot not found")
    return _row_to_response(row)


@router.patch("/slots/{slot_id}", response_model=TimetableSlotResponse, dependencies=admin_only)
async def update_timetable_slot(slot_id: str, body: TimetableSlotCreate, db: AsyncSession = Depends(get_db)):
    slot = await update_slot(slot_id, body.model_dump(), db)
    # Re-fetch with joins to include names
    q = _build_slots_query().where(TimetableSlot.id == slot.id)
    result = await db.execute(q)
    row = result.first()
    return _row_to_response(row)


@router.post("/slots/{slot_id}/publish", dependencies=admin_only)
async def publish_slot(slot_id: str, db: AsyncSession = Depends(get_db)):
    slot = await db.get(TimetableSlot, slot_id)
    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    slot.is_published = True
    await db.flush()
    return {"ok": True}


@router.delete("/slots/{slot_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=admin_only)
async def delete_slot(slot_id: str, db: AsyncSession = Depends(get_db)):
    slot = await db.get(TimetableSlot, slot_id)
    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    await db.delete(slot)

