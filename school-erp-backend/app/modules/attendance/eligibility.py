from datetime import date

from sqlalchemy import Date, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.academic.models import AcademicYear, Holiday
from app.modules.attendance.models import Attendance, LeaveApplication


async def count_working_days(academic_year_id: str, db: AsyncSession) -> int:
    year_result = await db.execute(
        select(AcademicYear).where(AcademicYear.id == academic_year_id)
    )
    year = year_result.scalar_one_or_none()
    if not year:
        return 0

    total_days = (year.end_date - year.start_date).days + 1
    holidays_result = await db.execute(
        select(func.count(Holiday.id)).where(
            Holiday.date >= year.start_date,
            Holiday.date <= year.end_date,
        )
    )
    holidays = holidays_result.scalar() or 0

    sundays = sum(
        1
        for i in range(total_days)
        if (year.start_date + __import__("datetime").timedelta(days=i)).weekday() == 6
    )

    return total_days - holidays - sundays


async def count_approved_leaves(student_id: str, academic_year_id: str, db: AsyncSession) -> int:
    year_result = await db.execute(
        select(AcademicYear).where(AcademicYear.id == academic_year_id)
    )
    year = year_result.scalar_one_or_none()
    if not year:
        return 0

    result = await db.execute(
        select(func.coalesce(func.sum(
            func.date(LeaveApplication.end_date) - func.date(LeaveApplication.start_date) + 1
        ), 0)).where(
            LeaveApplication.student_id == student_id,
            LeaveApplication.status == "APPROVED",
            LeaveApplication.start_date >= year.start_date,
            LeaveApplication.end_date <= year.end_date,
        )
    )
    return result.scalar() or 0


async def count_present_days(student_id: str, academic_year_id: str, db: AsyncSession) -> int:
    year_result = await db.execute(
        select(AcademicYear).where(AcademicYear.id == academic_year_id)
    )
    year = year_result.scalar_one_or_none()
    if not year:
        return 0

    result = await db.execute(
        select(func.count(func.distinct(Attendance.date))).where(
            Attendance.student_id == student_id,
            Attendance.date >= year.start_date,
            Attendance.date <= year.end_date,
            Attendance.status.in_(["PRESENT", "LATE"]),
        )
    )
    return result.scalar() or 0


async def get_eligibility(student_id: str, academic_year_id: str, db: AsyncSession) -> dict:
    working_days = await count_working_days(academic_year_id, db)
    approved_leaves = await count_approved_leaves(student_id, academic_year_id, db)
    present_days = await count_present_days(student_id, academic_year_id, db)

    effective_days = working_days - approved_leaves
    if effective_days <= 0:
        percentage = 100.0
    else:
        percentage = round((present_days / effective_days) * 100, 2)

    return {
        "working_days": working_days,
        "approved_leaves": approved_leaves,
        "present_days": present_days,
        "percentage": percentage,
        "is_eligible": percentage >= 75.0,
    }
