"""Test /auth/me for teacher."""
import asyncio
from app.core.database import get_db
from app.modules.auth.models import User
from app.modules.auth.router import get_me
from sqlalchemy import select

async def main():
    async for db in get_db():
        # Simulate what get_me does for a teacher
        user = (await db.execute(
            select(User).where(User.role == "teacher").limit(1)
        )).scalar_one_or_none()
        print(f"User: {user.id} {user.email} {user.role}")

        from app.modules.academic.models import Section, Class as AcademicClass
        sec = (await db.execute(
            select(Section).where(Section.class_teacher_id == user.id)
        )).scalar_one_or_none()
        print(f"Section: {sec}")
        if sec:
            print(f"Section name: {sec.name}, class_id: {sec.class_id}")
            cls = await db.get(AcademicClass, sec.class_id)
            print(f"Class: {cls}")
            if cls:
                print(f"Class name: {cls.name}")

        break

asyncio.run(main())
