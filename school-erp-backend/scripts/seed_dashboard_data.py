"""Seed attendance and homework data for demo."""
import asyncio
from datetime import date, timedelta
from app.core.database import get_db
from app.modules.auth.models import StudentProfile, User, StaffProfile
from app.modules.academic.models import Section, TeacherAssignment, Subject
from app.modules.attendance.models import Attendance
from app.modules.homework.models import HomeworkAssignment
from sqlalchemy import select, and_
from uuid import UUID

async def main():
    async for db in get_db():
        # --- Get data ---
        students = (await db.execute(select(StudentProfile))).scalars().all()
        print(f"Students: {len(students)}")

        teachers = {}
        t_result = await db.execute(
            select(User, StaffProfile)
            .join(StaffProfile, StaffProfile.user_id == User.id)
            .where(User.role == "teacher", User.deleted_at.is_(None))
        )
        for user, profile in t_result.all():
            teachers[str(user.id)] = f"{profile.first_name} {profile.last_name}"

        sections = (await db.execute(select(Section))).scalars().all()
        sections_by_id = {str(s.id): s for s in sections}

        subjects = (await db.execute(select(Subject))).scalars().all()
        subjects_by_id = {str(s.id): s for s in subjects}

        # --- Seed attendance (last 5 school days) ---
        today = date.today()
        school_days = []
        d = today - timedelta(days=14)
        while len(school_days) < 5:
            if d.weekday() < 5:
                school_days.append(d)
            d += timedelta(days=1)

        existing = await db.execute(
            select(Attendance.date).distinct()
        )
        existing_dates = {r[0] for r in existing.all()}

        att_count = 0
        for day in school_days:
            if day in existing_dates:
                continue
            for student in students:
                status = "Present" if hash(str(student.id) + str(day)) % 5 != 0 else "Absent"
                att = Attendance(
                    student_id=student.id,
                    date=day,
                    status=status,
                    marked_by=student.user_id,
                )
                db.add(att)
                att_count += 1
        await db.flush()
        print(f"Attendance records created: {att_count}")

        # --- Seed homework ---
        admin_user = (await db.execute(
            select(User).where(User.role == "super_admin", User.deleted_at.is_(None)).limit(1)
        )).scalar_one_or_none()

        hw_count = 0
        for section in sections:
            section_id = str(section.id)
            # Get teacher assignments for this section
            tas = (await db.execute(
                select(TeacherAssignment).where(TeacherAssignment.section_id == section_id)
            )).scalars().all()

            for ta in tas:
                teacher_id = str(ta.instructor_id)
                teacher_name = teachers.get(teacher_id, "Teacher")
                subj = subjects_by_id.get(str(ta.subject_id))
                subj_name = subj.name if subj else "Subject"

                hw = HomeworkAssignment(
                    title=f"{subj_name} Homework - {section.name}",
                    description=f"Complete Chapter {hash(str(ta.id)) % 10 + 1} exercises",
                    course=str(ta.subject_id),
                    course_name=subj_name,
                    student_group=section.name,
                    class_name=str(section.class_id),
                    academic_year="2026-2027",
                    due_date=today + timedelta(days=7),
                    max_points=20,
                    assigned_by=teacher_id,
                    assigned_by_name=teacher_name,
                    status="Published",
                    sync_status="pending",
                )
                db.add(hw)
                hw_count += 1
        await db.commit()
        print(f"Homework assignments created: {hw_count}")

        print("\nDone! Dashboard data ready.")
        break

asyncio.run(main())
