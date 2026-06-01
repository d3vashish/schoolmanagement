from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.core.database import get_db
from app.core.deps import QueryScoper, get_current_user, role_required
from app.modules.timetable.models import TimetableSlot
from app.modules.timetable.schemas import TimetableSlotCreate, TimetableSlotResponse
from app.modules.timetable.service import create_slot, update_slot

admin_only = [role_required("super_admin", "principal")]

router = APIRouter(prefix="/timetable", tags=["timetable"])


@router.get("/slots", response_model=list[TimetableSlotResponse])
async def list_slots(
    section_id: str | None = None,
    teacher_id: str | None = None,
    day_of_week: int | None = None,
    schedule_date: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    q = select(TimetableSlot)

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
    return result.scalars().all()


@router.post("/slots", response_model=TimetableSlotResponse, dependencies=admin_only)
async def create_timetable_slot(body: TimetableSlotCreate, db: AsyncSession = Depends(get_db)):
    return await create_slot(body.model_dump(), db)


@router.get("/slots/{slot_id}", response_model=TimetableSlotResponse)
async def get_slot(slot_id: str, db: AsyncSession = Depends(get_db)):
    slot = await db.get(TimetableSlot, slot_id)
    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slot not found")
    return slot


@router.patch("/slots/{slot_id}", response_model=TimetableSlotResponse, dependencies=admin_only)
async def update_timetable_slot(slot_id: str, body: TimetableSlotCreate, db: AsyncSession = Depends(get_db)):
    return await update_slot(slot_id, body.model_dump(), db)


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
