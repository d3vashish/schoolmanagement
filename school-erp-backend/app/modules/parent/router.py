from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, role_required
from app.modules.attendance.models import LeaveApplication, LeaveType
from app.modules.parent.deps import get_parent_child
from app.modules.parent.schemas import (
    AttendanceRecord,
    AggregateResponse,
    ChildResponse,
    CircularCreate,
    CircularResponse,
    CircularUpdate,
    EligibilityResponse,
    FeeDueResponse,
    MessageCreate,
    MessageResponse,
    NotificationPrefsResponse,
    NotificationPrefsUpdate,
)
from app.modules.parent.service import (
    apply_student_leave,
    create_circular,
    delete_circular,
    get_children,
    get_child_attendance,
    get_circulars,
    get_eligibility,
    get_fee_dues,
    get_messages_for_parent,
    get_or_create_prefs,
    get_results,
    send_message_to_teacher,
    update_circular,
    update_prefs,
)

router = APIRouter(prefix="/parent", tags=["parent"])
parent_only = [role_required("parent")]
all_auth = [Depends(get_current_user)]


@router.get("/children", response_model=list[ChildResponse])
async def list_children(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_children(current_user["id"], db)


@router.get("/child/{child_id}/attendance", response_model=list[AttendanceRecord])
async def child_attendance(
    child_id: UUID = Depends(get_parent_child),
    start: date = Query(...),
    end: date = Query(...),
    db: AsyncSession = Depends(get_db),
):
    records = await get_child_attendance(str(child_id), start, end, db)
    return records


@router.get("/child/{child_id}/fees/dues", response_model=list[FeeDueResponse])
async def child_fee_dues(
    child_id: UUID = Depends(get_parent_child),
    db: AsyncSession = Depends(get_db),
):
    return await get_fee_dues(str(child_id), db)


@router.get("/child/{child_id}/results")
async def child_results(
    child_id: UUID = Depends(get_parent_child),
    db: AsyncSession = Depends(get_db),
):
    return await get_results(str(child_id), db)


@router.get("/child/{child_id}/eligibility", response_model=EligibilityResponse)
async def child_eligibility(
    child_id: UUID = Depends(get_parent_child),
    academic_year_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    result = await get_eligibility(str(child_id), academic_year_id, db)
    return EligibilityResponse(student_id=child_id, **result)


@router.get("/circulars", response_model=list[CircularResponse])
async def list_circulars(
    db: AsyncSession = Depends(get_db),
):
    return await get_circulars(db)


@router.post("/circulars", response_model=CircularResponse, status_code=status.HTTP_201_CREATED)
async def create_circular_endpoint(
    body: CircularCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await create_circular(body, current_user["id"], db)


@router.patch("/circulars/{circular_id}", response_model=CircularResponse)
async def update_circular_endpoint(
    circular_id: str,
    body: CircularUpdate,
    db: AsyncSession = Depends(get_db),
):
    return await update_circular(circular_id, body, db)


@router.delete("/circulars/{circular_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_circular_endpoint(
    circular_id: str,
    db: AsyncSession = Depends(get_db),
):
    await delete_circular(circular_id, db)


@router.post("/child/{child_id}/message", response_model=MessageResponse)
async def send_message(
    body: MessageCreate,
    child_id: UUID = Depends(get_parent_child),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        msg = await send_message_to_teacher(
            parent_id=current_user["id"],
            student_id=str(child_id),
            subject=body.subject,
            body=body.body,
            db=db,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return msg


@router.get("/child/{child_id}/messages", response_model=list[MessageResponse])
async def list_messages(
    child_id: UUID = Depends(get_parent_child),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_messages_for_parent(
        parent_id=current_user["id"],
        student_id=str(child_id),
        db=db,
    )


@router.post("/child/{child_id}/leaves")
async def apply_leave(
    leave_type_id: str = Query(...),
    start_date: date = Query(...),
    end_date: date = Query(...),
    reason: str | None = Query(None),
    child_id: UUID = Depends(get_parent_child),
    db: AsyncSession = Depends(get_db),
):
    leave = await apply_student_leave(
        student_id=str(child_id),
        leave_type_id=leave_type_id,
        start_date=start_date,
        end_date=end_date,
        reason=reason,
        db=db,
    )
    return {
        "id": leave.id,
        "status": leave.status,
        "start_date": leave.start_date,
        "end_date": leave.end_date,
    }


@router.get("/child/{child_id}/leaves")
async def list_leaves(
    child_id: UUID = Depends(get_parent_child),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LeaveApplication)
        .where(LeaveApplication.student_id == child_id)
        .order_by(LeaveApplication.created_at.desc())
    )
    return result.scalars().all()


@router.get("/notifications/prefs", response_model=NotificationPrefsResponse)
async def get_notification_prefs(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_or_create_prefs(current_user["id"], db)


@router.patch("/notifications/prefs", response_model=NotificationPrefsResponse)
async def update_notification_prefs(
    body: NotificationPrefsUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await update_prefs(
        user_id=current_user["id"],
        data=body.model_dump(exclude_none=True),
        db=db,
    )
