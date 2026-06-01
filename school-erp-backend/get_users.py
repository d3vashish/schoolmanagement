import asyncio
from app.core.database import get_db
from app.modules.auth.models import User
from sqlalchemy import select

async def main():
    db = [d async for d in get_db()][0]
    users = (await db.execute(select(User))).scalars().all()
    for u in users:
        print(f"{u.email} ({u.role})")

asyncio.run(main())
