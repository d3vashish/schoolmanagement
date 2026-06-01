import asyncio

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.modules.library.models import BookCopy, BookIssue


@pytest.mark.asyncio
async def test_library_concurrent_issue(client: AsyncClient, db_session):
    from tests.factories import (
        create_book_category,
        create_book_with_copy,
        create_user,
    )

    cat = await create_book_category(db_session)
    book, copy = await create_book_with_copy(db_session, cat.id)
    librarian = await create_user(db_session, role="librarian", email="lib@test.edu")
    student1 = await create_user(db_session, role="student", email="s1_lib@test.edu")
    student2 = await create_user(db_session, role="student", email="s2_lib@test.edu")

    from app.core.security import create_access_token
    lib_token = create_access_token(str(librarian.id), "librarian")

    async def try_issue(student_id: str) -> bool:
        payload = {"copy_id": str(copy.id), "issued_to": student_id}
        resp = await client.post(
            "/library/issue",
            json=payload,
            headers={"Authorization": f"Bearer {lib_token}"},
        )
        return resp.status_code == 200

    results = await asyncio.gather(
        try_issue(str(student1.id)),
        try_issue(str(student2.id)),
    )

    success_count = sum(1 for r in results if r)
    assert success_count <= 1, f"Expected at most 1 successful issue, got {success_count}"

    issued = await db_session.execute(
        select(BookIssue).where(BookIssue.copy_id == copy.id, BookIssue.status == "ISSUED")
    )
    assert len(issued.scalars().all()) <= 1


@pytest.mark.asyncio
async def test_borrow_limit_enforced(client: AsyncClient, db_session):
    from tests.factories import (
        create_book_category,
        create_book_with_copy,
        create_student_profile,
        create_user,
    )

    cat = await create_book_category(db_session)
    student_user = await create_user(db_session, role="student", email="limit_s@test.edu")
    librarian = await create_user(db_session, role="librarian", email="limit_lib@test.edu")

    from app.core.security import create_access_token
    lib_token = create_access_token(str(librarian.id), "librarian")

    issues = 0
    for _ in range(3):
        _, copy = await create_book_with_copy(db_session, cat.id)
        payload = {"copy_id": str(copy.id), "issued_to": str(student_user.id)}
        resp = await client.post(
            "/library/issue",
            json=payload,
            headers={"Authorization": f"Bearer {lib_token}"},
        )
        if resp.status_code == 200:
            issues += 1

    assert issues <= 2
