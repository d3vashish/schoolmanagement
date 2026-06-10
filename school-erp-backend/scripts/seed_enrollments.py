"""Create Enrollment records for all existing students.
Distributes students evenly across all classes (1-12)."""

import asyncio
from app.core.database import get_db
from app.modules.auth.models import StudentProfile
from app.modules.academic.models import Enrollment, Class as AcademicClass, AcademicYear
from sqlalchemy import select

async def main():
    async for db in get_db():
        students = (await db.execute(select(StudentProfile))).scalars().all()
        classes = (await db.execute(select(AcademicClass).order_by(AcademicClass.order))).scalars().all()
        year = (await db.execute(select(AcademicYear).where(AcademicYear.is_active.is_(True)))).scalar_one_or_none()

        if not year:
            print("ERROR: No active academic year found")
            return
        if not classes:
            print("ERROR: No classes found")
            return
        if not students:
            print("No students to enroll")
            return

        print(f"Students: {len(students)}, Classes: {len(classes)}, Active year: {year.name}")

        existing = (await db.execute(select(Enrollment).limit(1))).scalar_one_or_none()
        if existing:
            print("Enrollments already exist — skipping")
            return

        count = 0
        for i, student in enumerate(students):
            cls = classes[i % len(classes)]
            enrollment = Enrollment(
                student_id=student.id,
                class_id=cls.id,
                academic_year_id=year.id,
                status="ACTIVE",
            )
            db.add(enrollment)
            count += 1

        await db.commit()
        print(f"Created {count} enrollment records")

asyncio.run(main())
