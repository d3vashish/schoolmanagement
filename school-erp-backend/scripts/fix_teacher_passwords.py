import asyncio
from app.core.database import get_db
from app.modules.auth.models import User
from app.core.security import hash_password, verify_password
from sqlalchemy import select

async def main():
    async for db in get_db():
        rajesh = await db.execute(select(User).where(User.email == "rajesh.kumar@school.com"))
        rajesh = rajesh.scalar_one_or_none()
        if rajesh:
            pw = rajesh.hashed_pw
            print(f"Rajesh hashed_pw starts with: {pw[:20] if pw else 'None'}...")

            for pw in ["teacher123", "password123", "Teacher@123", "pass123", "school123"]:
                result = verify_password(pw, rajesh.hashed_pw)
                print(f'  "{pw}": {result}')

        # Reset all teachers to known password
        teachers = await db.execute(
            select(User).where(User.role == "teacher", User.deleted_at.is_(None))
        )
        count = 0
        for t in teachers.scalars().all():
            t.hashed_pw = hash_password("teacher123")
            count += 1
        await db.commit()
        print(f"\nReset {count} teacher passwords to 'teacher123'")

        # Verify
        rajesh2 = await db.execute(select(User).where(User.email == "rajesh.kumar@school.com"))
        rajesh2 = rajesh2.scalar_one_or_none()
        print(f"Verify rajesh: {verify_password('teacher123', rajesh2.hashed_pw)}")
        break

asyncio.run(main())
