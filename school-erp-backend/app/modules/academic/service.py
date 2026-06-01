from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import StudentProfile, User
from app.modules.academic.models import AcademicProgression, AcademicYear, Class


class PromotionError(Exception):
    pass


async def promote_students(
    db: AsyncSession,
    student_ids: list[UUID],
    from_academic_year_id: UUID,
    to_academic_year_id: UUID,
    to_class_id: UUID,
    promoted_by_user_id: UUID,
) -> list[AcademicProgression]:
    from_year = await db.get(AcademicYear, from_academic_year_id)
    to_year = await db.get(AcademicYear, to_academic_year_id)
    if not from_year or not to_year:
        raise PromotionError("Academic year not found")

    target_class = await db.get(Class, to_class_id)
    if not target_class:
        raise PromotionError("Target class not found")

    students = (
        await db.execute(
            select(StudentProfile)
            .join(User, StudentProfile.user_id == User.id)
            .where(
                StudentProfile.id.in_(student_ids),
                User.is_active.is_(True),
            )
        )
    ).scalars().all()

    found_ids = {str(s.id) for s in students}
    for sid in student_ids:
        if str(sid) not in found_ids:
            raise PromotionError(f"Student {sid} not found or inactive")

    existing = (
        await db.execute(
            select(AcademicProgression).where(
                AcademicProgression.student_id.in_(student_ids),
                AcademicProgression.to_academic_year_id == to_academic_year_id,
            )
        )
    ).scalars().all()
    if existing:
        raise PromotionError(
            f"Students {[str(e.student_id) for e in existing]} already have progression records for this year"
        )

    progressions = []
    now = datetime.now(timezone.utc)

    for student in students:
        is_retained = student.class_id == to_class_id
        from_class_id = student.class_id

        if not is_retained:
            student.class_id = to_class_id

        prog = AcademicProgression(
            student_id=student.id,
            from_class_id=from_class_id,
            to_class_id=to_class_id,
            from_academic_year_id=from_academic_year_id,
            to_academic_year_id=to_academic_year_id,
            is_retained=is_retained,
            promoted_by=promoted_by_user_id,
            promoted_at=now,
        )
        db.add(prog)
        progressions.append(prog)

    await db.flush()
    return progressions
