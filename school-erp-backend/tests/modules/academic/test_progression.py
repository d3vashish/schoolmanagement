import pytest
from httpx import AsyncClient
from uuid import uuid4

from app.modules.academic.models import AcademicProgression
from app.modules.academic.service import promote_students, PromotionError
from tests.factories import (
    create_student_profile,
    create_academic_year,
    create_class,
    create_user,
)

pytestmark = pytest.mark.asyncio


async def _admin_headers(client: AsyncClient, db_session) -> dict:
    user = await create_user(db_session, email="admin_prog@test.edu", role="super_admin")
    resp = await client.post("/auth/login", json={
        "email": "admin_prog@test.edu",
        "password": "dummy",
    })
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def test_promote_students_happy_path(db_session):
    from_class = await create_class(db_session, uuid4())
    to_class = await create_class(db_session, uuid4())
    from_class.name = "Class 10"
    to_class.name = "Class 11"
    from_class.order = 10
    to_class.order = 11
    await db_session.flush()

    from_year = await create_academic_year(db_session)
    to_year = await create_academic_year(db_session)
    student = await create_student_profile(db_session, class_id=from_class.id)
    admin = await create_user(db_session, role="super_admin")

    progressions = await promote_students(
        db=db_session,
        student_ids=[student.id],
        from_academic_year_id=from_year.id,
        to_academic_year_id=to_year.id,
        to_class_id=to_class.id,
        promoted_by_user_id=admin.id,
    )

    assert len(progressions) == 1
    assert progressions[0].is_retained is False
    assert str(progressions[0].to_class_id) == str(to_class.id)

    await db_session.refresh(student)
    assert str(student.class_id) == str(to_class.id)


async def test_promote_students_retention(db_session):
    same_class = await create_class(db_session, uuid4())
    same_class.name = "Class 10"
    same_class.order = 10
    await db_session.flush()

    from_year = await create_academic_year(db_session)
    to_year = await create_academic_year(db_session)
    student = await create_student_profile(db_session, class_id=same_class.id)
    admin = await create_user(db_session, role="super_admin")

    progressions = await promote_students(
        db=db_session,
        student_ids=[student.id],
        from_academic_year_id=from_year.id,
        to_academic_year_id=to_year.id,
        to_class_id=same_class.id,
        promoted_by_user_id=admin.id,
    )

    assert len(progressions) == 1
    assert progressions[0].is_retained is True

    await db_session.refresh(student)
    assert str(student.class_id) == str(same_class.id)


async def test_promote_students_duplicate_guard(db_session):
    from_class = await create_class(db_session, uuid4())
    to_class = await create_class(db_session, uuid4())
    from_class.name = "Class 10"
    to_class.name = "Class 11"
    from_class.order = 10
    to_class.order = 11
    await db_session.flush()

    from_year = await create_academic_year(db_session)
    to_year = await create_academic_year(db_session)
    student = await create_student_profile(db_session, class_id=from_class.id)
    admin = await create_user(db_session, role="super_admin")

    await promote_students(
        db=db_session,
        student_ids=[student.id],
        from_academic_year_id=from_year.id,
        to_academic_year_id=to_year.id,
        to_class_id=to_class.id,
        promoted_by_user_id=admin.id,
    )

    with pytest.raises(PromotionError, match="already have progression records"):
        await promote_students(
            db=db_session,
            student_ids=[student.id],
            from_academic_year_id=from_year.id,
            to_academic_year_id=to_year.id,
            to_class_id=to_class.id,
            promoted_by_user_id=admin.id,
        )


async def test_promote_students_inactive_student(db_session):
    to_class = await create_class(db_session, uuid4())
    to_class.name = "Class 11"
    to_class.order = 11
    await db_session.flush()

    from_year = await create_academic_year(db_session)
    to_year = await create_academic_year(db_session)
    inactive_user = await create_user(db_session, role="student", is_active=False)
    student = await create_student_profile(db_session, user_id=inactive_user.id)
    admin = await create_user(db_session, role="super_admin")

    with pytest.raises(PromotionError, match="not found or inactive"):
        await promote_students(
            db=db_session,
            student_ids=[student.id],
            from_academic_year_id=from_year.id,
            to_academic_year_id=to_year.id,
            to_class_id=to_class.id,
            promoted_by_user_id=admin.id,
        )


async def test_list_progressions(client, db_session):
    headers = await _admin_headers(client, db_session)
    from_class = await create_class(db_session, uuid4())
    to_class = await create_class(db_session, uuid4())
    from_class.name = "Class 10"
    to_class.name = "Class 11"
    from_class.order = 10
    to_class.order = 11
    await db_session.flush()

    from_year = await create_academic_year(db_session)
    to_year = await create_academic_year(db_session)
    student = await create_student_profile(db_session, class_id=from_class.id)
    admin = await create_user(db_session, role="super_admin")

    await promote_students(
        db=db_session,
        student_ids=[student.id],
        from_academic_year_id=from_year.id,
        to_academic_year_id=to_year.id,
        to_class_id=to_class.id,
        promoted_by_user_id=admin.id,
    )

    response = await client.get(
        f"/academic/progression?academic_year_id={to_year.id}",
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["is_retained"] is False
