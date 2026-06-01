import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.modules.parent.models import ParentStudentLink


@pytest.mark.asyncio
async def test_parent_cannot_access_other_child(client: AsyncClient, db_session):
    from tests.factories import (
        create_user,
        create_student_profile,
    )

    parent1 = await create_user(db_session, role="parent", email="p1@test.edu")
    parent2 = await create_user(db_session, role="parent", email="p2@test.edu")
    child1 = await create_student_profile(db_session, user_id=(await create_user(db_session, role="student", email="c1@test.edu")).id)
    child2 = await create_student_profile(db_session, user_id=(await create_user(db_session, role="student", email="c2@test.edu")).id)

    link1 = ParentStudentLink(parent_id=parent1.id, student_id=child1.id)
    db_session.add(link1)
    await db_session.flush()

    from app.core.security import create_access_token
    p1_token = create_access_token(str(parent1.id), "parent")

    resp_own = await client.get(
        f"/parent/child/{child1.id}/attendance?start=2026-01-01&end=2026-12-31",
        headers={"Authorization": f"Bearer {p1_token}"},
    )
    assert resp_own.status_code == 200

    resp_other = await client.get(
        f"/parent/child/{child2.id}/attendance?start=2026-01-01&end=2026-12-31",
        headers={"Authorization": f"Bearer {p1_token}"},
    )
    assert resp_other.status_code == 403


@pytest.mark.asyncio
async def test_parent_lists_only_own_children(client: AsyncClient, db_session):
    from tests.factories import (
        create_user,
        create_student_profile,
    )
    from app.modules.parent.models import ParentStudentLink

    parent = await create_user(db_session, role="parent", email="listowns@test.edu")
    own_child = await create_student_profile(db_session, user_id=(await create_user(db_session, role="student", email="own@test.edu")).id)
    other_child = await create_student_profile(db_session, user_id=(await create_user(db_session, role="student", email="other@test.edu")).id)

    db_session.add(ParentStudentLink(parent_id=parent.id, student_id=own_child.id))
    await db_session.flush()

    from app.core.security import create_access_token
    token = create_access_token(str(parent.id), "parent")

    resp = await client.get(
        "/parent/children",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    children = resp.json()
    assert len(children) == 1
    assert str(own_child.id) in str(children[0]["student_id"])
