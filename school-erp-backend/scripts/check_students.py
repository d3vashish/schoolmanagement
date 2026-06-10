import asyncio
from app.core.database import get_db
from app.modules.auth.models import User
from app.modules.academic.models import Enrollment, Class, Section, AcademicYear
from sqlalchemy import select

async def main():
    async for db in get_db():
        enrollments = await db.execute(
            select(Enrollment).where(Enrollment.status == "ACTIVE")
        )
        enrollments = enrollments.scalars().all()

        with_section = [e for e in enrollments if e.section_id]
        without_section = [e for e in enrollments if not e.section_id]
        print(f"Active enrollments total: {len(enrollments)}")
        print(f"With section: {len(with_section)}")
        print(f"Without section: {len(without_section)}")

        if without_section:
            print("\nSample enrollments without section:")
            for e in without_section[:5]:
                cls = await db.get(Class, e.class_id)
                year = await db.get(AcademicYear, e.academic_year_id)
                print(f"  Enrollment {e.id}: student={e.student_id} class={cls.name if cls else '?'} year={year.name if year else '?'}")

        if with_section:
            print("\nSample enrollments WITH section:")
            for e in with_section[:5]:
                cls = await db.get(Class, e.class_id)
                sec = await db.get(Section, e.section_id)
                year = await db.get(AcademicYear, e.academic_year_id)
                print(f"  Enrollment {e.id}: student={e.student_id} class={cls.name if cls else '?'} section={sec.name if sec else '?'} year={year.name if year else '?'}")

        break

asyncio.run(main())
