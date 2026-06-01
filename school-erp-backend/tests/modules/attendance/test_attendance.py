from datetime import date

import pytest
from httpx import AsyncClient

from app.modules.academic.models import AcademicYear
from app.modules.attendance.eligibility import get_eligibility
from app.modules.attendance.models import Attendance, LeaveApplication
from app.core.security import create_access_token


@pytest.mark.asyncio
async def test_attendance_eligibility_75pct(client: AsyncClient, db_session):
    from tests.factories import (
        create_academic_year,
        create_class,
        create_student_profile,
        create_leave_type,
        create_user,
    )

    ay = await create_academic_year(db_session)
    cls = await create_class(db_session, ay.id)
    student = await create_student_profile(db_session)

    admin = await create_user(db_session, role="super_admin", email="att_admin@test.edu")

    marker = 0
    d = ay.start_date
    while d <= ay.end_date and marker < 100:
        if d.weekday() != 6 and not await _is_holiday(db_session, d):
            Attendance(
                student_id=student.id,
                date=d,
                status="PRESENT" if marker % 5 != 0 else "ABSENT",
                marked_by=admin.id,
            )
            marker += 1
        d += __import__("datetime").timedelta(days=1)
    await db_session.flush()

    result = await get_eligibility(str(student.id), str(ay.id), db_session)
    assert "percentage" in result
    assert result["working_days"] > 0


async def _is_holiday(db, d):
    from sqlalchemy import select
    from app.modules.academic.models import Holiday
    r = await db.execute(select(Holiday).where(Holiday.date == d))
    return r.scalar_one_or_none() is not None
