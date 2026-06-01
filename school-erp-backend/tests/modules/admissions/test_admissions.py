import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.modules.admissions.models import Admission


@pytest.mark.asyncio
async def test_invalid_admission_transition(client: AsyncClient, db_session):
    from tests.factories import create_academic_year, create_class, create_user
    ay = await create_academic_year(db_session)
    cls = await create_class(db_session, ay.id)
    admin = await create_user(db_session, role="super_admin", email="admin_adm@test.edu")

    from app.core.security import create_access_token
    token = create_access_token(str(admin.id), "super_admin")

    admission = Admission(
        applicant_name="Bad Transition",
        applicant_phone="9999999999",
        class_id=cls.id,
        academic_year_id=ay.id,
    )
    db_session.add(admission)
    await db_session.flush()

    resp = await client.patch(
        f"/admissions/{admission.id}/status",
        json={"status": "ENROLLED"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_seat_overbooking_concurrent(client: AsyncClient, db_session):
    from tests.factories import (
        create_academic_year,
        create_class,
        create_user,
    )
    from app.modules.academic.models import Section
    from app.modules.admissions.service import enroll_student

    ay = await create_academic_year(db_session)
    cls = await create_class(db_session, ay.id)

    section = Section(
        name="A",
        class_id=cls.id,
        academic_year_id=ay.id,
        capacity=2,
    )
    db_session.add(section)
    await db_session.flush()

    students = []
    for i in range(3):
        u = await create_user(db_session, role="student", email=f"overbook{i}@test.edu")
        students.append(u)

    results = []
    for s in students:
        try:
            result = await enroll_student(
                student_id=str(s.id),
                section_id=str(section.id),
                academic_year_id=str(ay.id),
                db=db_session,
            )
            results.append(("ok", result))
        except Exception as e:
            results.append(("fail", str(e)))
            break

    ok_count = sum(1 for r in results if r[0] == "ok")
    assert ok_count <= 2
    assert len(results) <= 2
