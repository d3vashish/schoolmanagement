import asyncio
from app.core.database import get_db
from app.modules.auth.models import User
from app.core.security import hash_password
from sqlalchemy import select

async def main():
    async for db in get_db():
        users = await db.execute(select(User))
        count = 0
        hashed_pw = hash_password("password123")
        for u in users.scalars().all():
            u.hashed_pw = hashed_pw
            count += 1
        await db.commit()
        print(f"Reset {count} user passwords to 'password123'")
        break

asyncio.run(main())
