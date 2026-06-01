import asyncio
from app.core.database import get_db
from app.modules.auth.models import User, StudentProfile
from sqlalchemy import select

async def main():
    async for db in get_db():
        students = await db.execute(select(StudentProfile))
        students = students.scalars().all()
        with_section = [s for s in students if s.section_id]
        without_section = [s for s in students if not s.section_id]
        print(f"Students total: {len(students)}")
        print(f"With section: {len(with_section)}")
        print(f"Without section: {len(without_section)}")

        if without_section:
            print("\nSample students without section:")
            for s in without_section[:5]:
                user = await db.execute(select(User).where(User.id == s.user_id))
                user = user.scalar_one_or_none()
                print(f"  Student {s.id}: user={s.user_id} class_id={s.class_id} section_id={s.section_id} email={user.email if user else 'N/A'}")

        if with_section:
            print("\nSample students WITH section:")
            for s in with_section[:5]:
                print(f"  Student {s.id}: user={s.user_id} class_id={s.class_id} section_id={s.section_id}")

        break

asyncio.run(main())
