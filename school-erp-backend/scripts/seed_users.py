import asyncio
from app.core.database import get_db
from app.modules.auth.models import User
from app.core.security import hash_password

USERS = [
    {"email": "admin@school.com", "password": "admin123", "role": "super_admin"},
    {"email": "principal@school.com", "password": "principal123", "role": "principal"},
    {"email": "teacher@school.com", "password": "teacher123", "role": "teacher"},
    {"email": "accountant@school.com", "password": "accountant123", "role": "accountant"},
    {"email": "librarian@school.com", "password": "librarian123", "role": "librarian"},
    {"email": "parent@school.com", "password": "parent123", "role": "parent"},
    {"email": "student@school.com", "password": "student123", "role": "student"},
]

async def main():
    async for db in get_db():
        from sqlalchemy import select
        for u in USERS:
            existing = (await db.execute(select(User).where(User.email == u["email"]))).scalar_one_or_none()
            if existing:
                print(f"SKIP {u['email']} - already exists")
                continue
            user = User(
                email=u["email"],
                hashed_pw=hash_password(u["password"]),
                role=u["role"],
                is_active=True,
            )
            db.add(user)
            await db.flush()
            print(f"CREATED {u['email']} ({u['role']})")
        await db.commit()
        break

asyncio.run(main())
