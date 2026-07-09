from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.class_tests.models import ClassTest, ClassTestMark


async def get_section_roster(section_id: str, db: AsyncSession) -> list[dict]:
    from app.modules.academic.models import Enrollment
    from app.modules.auth.models import StudentProfile, User

    # Roster = students enrolled in this section. We match on the section rather
    # than status == "ACTIVE" so that students who were promoted out of the
    # section in a later year still appear on that section's past tests.
    result = await db.execute(
        select(StudentProfile.id, StudentProfile.first_name, StudentProfile.last_name, StudentProfile.admission_number)
        .join(User, User.id == StudentProfile.user_id)
        .join(Enrollment, Enrollment.student_id == StudentProfile.id)
        .where(
            Enrollment.section_id == section_id,
            User.deleted_at.is_(None),
            User.is_active.is_(True),
        )
        .distinct()
        .order_by(StudentProfile.first_name)
    )
    return [
        {
            "id": str(r.id),
            "name": f"{r.first_name or ''} {r.last_name or ''}".strip() or "—",
            "admission_number": r.admission_number,
        }
        for r in result.all()
    ]


async def get_test_with_counts(test_id: str, db: AsyncSession) -> dict:
    from app.modules.academic.models import Class, Section

    result = await db.execute(
        select(ClassTest, Section.name.label("section_name"), Class.name.label("class_name"))
        .join(Section, Section.id == ClassTest.section_id)
        .join(Class, Class.id == Section.class_id)
        .where(ClassTest.id == test_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class test not found")

    test, section_name, class_name = row

    roster = await get_section_roster(str(test.section_id), db)
    student_count = len(roster)

    marks_result = await db.execute(
        select(ClassTestMark).where(ClassTestMark.test_id == test_id)
    )
    marks = {str(m.student_id): m.marks_obtained for m in marks_result.scalars().all()}
    entered_count = sum(1 for v in marks.values() if v is not None)

    return {
        "id": test.id,
        "title": test.title,
        "description": test.description,
        "section_id": test.section_id,
        "section_name": section_name,
        "class_name": class_name,
        "test_date": test.test_date,
        "max_marks": test.max_marks,
        "created_by": test.created_by,
        "created_at": test.created_at,
        "student_count": student_count,
        "entered_count": entered_count,
    }


async def get_test_detail(test_id: str, db: AsyncSession) -> dict:
    base = await get_test_with_counts(test_id, db)
    roster = await get_section_roster(str(base["section_id"]), db)

    marks_result = await db.execute(
        select(ClassTestMark).where(ClassTestMark.test_id == test_id)
    )
    marks = {str(m.student_id): m.marks_obtained for m in marks_result.scalars().all()}

    students = [
        {
            "student_id": s["id"],
            "student_name": s["name"],
            "admission_number": s["admission_number"],
            "marks_obtained": marks.get(s["id"]),
        }
        for s in roster
    ]

    return {**base, "students": students}


async def list_tests_for_section(section_id: str, db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(ClassTest.id).where(ClassTest.section_id == section_id).order_by(ClassTest.test_date.desc().nullslast(), ClassTest.created_at.desc())
    )
    test_ids = [str(r[0]) for r in result.all()]
    return [await get_test_with_counts(tid, db) for tid in test_ids]


async def create_test(db: AsyncSession, data: dict, created_by: str) -> ClassTest:
    test = ClassTest(**data, created_by=created_by)
    db.add(test)
    await db.flush()
    return test


async def update_test(db: AsyncSession, test_id: str, data: dict) -> ClassTest:
    test = await db.get(ClassTest, test_id)
    if not test:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class test not found")
    for key, value in data.items():
        if value is not None:
            setattr(test, key, value)
    await db.flush()
    return test


async def delete_test(db: AsyncSession, test_id: str) -> None:
    test = await db.get(ClassTest, test_id)
    if not test:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class test not found")
    await db.delete(test)
    await db.flush()


async def save_marks(db: AsyncSession, test_id: str, entries: list[dict]) -> None:
    test = await db.get(ClassTest, test_id)
    if not test:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class test not found")

    for entry in entries:
        student_id = entry["student_id"]
        marks_obtained = entry.get("marks_obtained")

        if marks_obtained is not None and marks_obtained > test.max_marks:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Marks ({marks_obtained}) cannot exceed max marks ({test.max_marks})",
            )

        existing = await db.execute(
            select(ClassTestMark).where(
                ClassTestMark.test_id == test_id,
                ClassTestMark.student_id == student_id,
            )
        )
        mark_row = existing.scalar_one_or_none()
        if mark_row:
            mark_row.marks_obtained = marks_obtained
        else:
            db.add(ClassTestMark(test_id=test_id, student_id=student_id, marks_obtained=marks_obtained))

    await db.flush()