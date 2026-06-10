from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import Date, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.academic.utils import is_working_day
from app.modules.attendance.models import (
    Attendance,
    LeaveApplication,
    LeaveType,
)
from app.modules.auth.models import ParentProfile, StudentProfile


async def mark_attendance(
    student_id: str,
    attendance_date: date,
    status: str,
    marked_by: str,
    period_no: int | None = None,
    section_id: str | None = None,
    subject_id: str | None = None,
    academic_year_id: str | None = None,
    db: AsyncSession = None,
) -> Attendance:
    if not await is_working_day(attendance_date, db):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot mark attendance on a holiday")

    stmt = (
        insert(Attendance)
        .values(
            student_id=student_id,
            date=attendance_date,
            period_no=period_no,
            status=status,
            marked_by=marked_by,
            section_id=section_id,
            subject_id=subject_id,
            academic_year_id=academic_year_id,
        )
        .on_conflict_do_update(
            index_elements=["student_id", "date", "period_no"],
            set_={
                "status": status,
                "marked_by": marked_by,
                "is_corrected": True,
                "corrected_by": marked_by,
            },
        )
    )
    await db.execute(stmt)
    await db.flush()

    result = await db.execute(
        select(Attendance).where(
            Attendance.student_id == student_id,
            Attendance.date == attendance_date,
            Attendance.period_no == period_no,
        )
    )
    record = result.scalar_one()

    if status == "ABSENT":
        await _notify_parents(student_id, attendance_date, db)

    return record


async def _notify_parents(student_id: str, attendance_date: date, db: AsyncSession) -> None:
    result = await db.execute(
        select(ParentProfile).where(ParentProfile.student_id == student_id)
    )
    parents = result.scalars().all()
    for parent in parents:
        if parent.phone:
            pass


async def update_attendance_status(attendance_id: str, status: str, db: AsyncSession) -> Attendance:
    record = await db.get(Attendance, attendance_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance record not found")
    record.status = status
    record.is_corrected = True
    await db.flush()
    await db.refresh(record)
    return record


async def get_student_attendance(
    student_id: str,
    start_date: date,
    end_date: date,
    db: AsyncSession,
) -> list[Attendance]:
    result = await db.execute(
        select(Attendance)
        .where(
            Attendance.student_id == student_id,
            Attendance.date >= start_date,
            Attendance.date <= end_date,
        )
        .order_by(Attendance.date, Attendance.period_no)
    )
    return result.scalars().all()


async def apply_leave(
    student_id: str,
    leave_type_id: str,
    start_date: date,
    end_date: date,
    reason: str | None,
    db: AsyncSession,
) -> LeaveApplication:
    leave = LeaveApplication(
        student_id=student_id,
        leave_type_id=leave_type_id,
        start_date=start_date,
        end_date=end_date,
        reason=reason,
        status="PENDING",
    )
    db.add(leave)
    await db.flush()
    return leave


async def approve_leave(
    leave_id: str,
    approved_by: str,
    status: str,
    db: AsyncSession,
) -> LeaveApplication:
    leave = await db.get(LeaveApplication, leave_id)
    if not leave:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave not found")
    if leave.status != "PENDING":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Leave already processed")

    leave.status = status
    leave.approved_by = approved_by
    leave.approved_at = datetime.now(timezone.utc)
    await db.flush()
    return leave
