import asyncio
from app.core.database import get_db
from app.modules.auth.models import StudentProfile
from app.modules.academic.models import Section
from sqlalchemy import select

async def main():
    async for db in get_db():
        students = await db.execute(select(StudentProfile))
        students = students.scalars().all()

        sections = await db.execute(select(Section).order_by(Section.name))
        sections = sections.scalars().all()

        # Group sections by class
        sections_by_class = {}
        for sec in sections:
            sections_by_class.setdefault(str(sec.class_id), []).append(sec)

        # Group students by class
        students_by_class = {}
        for s in students:
            students_by_class.setdefault(str(s.class_id), []).append(s)

        updated = 0
        for cid, class_students in students_by_class.items():
            class_sections = sections_by_class.get(cid, [])
            if not class_sections:
                print(f"  WARN: No sections for class {cid}, {len(class_students)} students left unassigned")
                continue

            # Distribute round-robin
            for i, student in enumerate(class_students):
                section = class_sections[i % len(class_sections)]
                student.section_id = section.id
                updated += 1

        await db.commit()
        print(f"Assigned {updated} students to sections")

        # Verify
        verify = await db.execute(select(StudentProfile))
        verify = verify.scalars().all()
        with_sec = [s for s in verify if s.section_id]
        without_sec = [s for s in verify if not s.section_id]
        print(f"After assignment: {len(with_sec)} with section, {len(without_sec)} without")

asyncio.run(main())
