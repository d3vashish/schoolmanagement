import asyncio
from app.core.database import get_db
from app.modules.auth.models import StudentProfile
from app.modules.academic.models import Enrollment, Section
from sqlalchemy import select

async def main():
    async for db in get_db():
        enrollments = await db.execute(
            select(Enrollment).where(Enrollment.status == "ACTIVE")
        )
        enrollments = enrollments.scalars().all()

        sections = await db.execute(select(Section).order_by(Section.name))
        sections = sections.scalars().all()

        sections_by_class = {}
        for sec in sections:
            sections_by_class.setdefault(str(sec.class_id), []).append(sec)

        enrollments_by_class = {}
        for e in enrollments:
            enrollments_by_class.setdefault(str(e.class_id), []).append(e)

        updated = 0
        for cid, class_enrollments in enrollments_by_class.items():
            class_sections = sections_by_class.get(cid, [])
            if not class_sections:
                print(f"  WARN: No sections for class {cid}, {len(class_enrollments)} students left unassigned")
                continue

            for i, enrollment in enumerate(class_enrollments):
                section = class_sections[i % len(class_sections)]
                enrollment.section_id = section.id
                updated += 1

        await db.commit()
        print(f"Assigned {updated} enrollments to sections")

        verify = await db.execute(
            select(Enrollment).where(Enrollment.status == "ACTIVE")
        )
        verify = verify.scalars().all()
        with_sec = [e for e in verify if e.section_id]
        without_sec = [e for e in verify if not e.section_id]
        print(f"After assignment: {len(with_sec)} with section, {len(without_sec)} without")

asyncio.run(main())
