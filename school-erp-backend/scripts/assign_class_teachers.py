"""Assign some teachers as class teachers (class_teacher_id on sections)."""
import asyncio
from app.core.database import get_db
from app.modules.academic.models import Section, TeacherAssignment
from app.modules.auth.models import User, StaffProfile
from sqlalchemy import select

async def main():
    async for db in get_db():
        sections = (await db.execute(select(Section))).scalars().all()
        teachers = {}
        t_result = await db.execute(
            select(User, StaffProfile)
            .join(StaffProfile, StaffProfile.user_id == User.id)
            .where(User.role == "teacher", User.deleted_at.is_(None))
        )
        for user, profile in t_result.all():
            teachers[str(user.id)] = f"{profile.first_name} {profile.last_name}"

        teacher_ids = list(teachers.keys())
        updated = 0
        for i, section in enumerate(sections):
            tid = teacher_ids[i % len(teacher_ids)]
            if str(section.class_teacher_id) != tid:
                section.class_teacher_id = tid
                updated += 1

        await db.commit()
        print(f"Updated {updated} sections with class teachers")

        # Verify
        verify = (await db.execute(select(Section))).scalars().all()
        for s in verify[:5]:
            print(f"  Section {s.name} (class={s.class_id}): class_teacher={s.class_teacher_id}")

        print(f"\nAll {len(verify)} sections have class teachers: {sum(1 for s in verify if s.class_teacher_id)}")

asyncio.run(main())
