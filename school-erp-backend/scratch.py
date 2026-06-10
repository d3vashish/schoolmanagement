import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def main():
    engine = create_async_engine('postgresql+asyncpg://erp_user:erp_pass@localhost:5432/school_erp')
    conn = await engine.connect()
    res = await conn.execute(text("SELECT id, user_id FROM staff_instructors WHERE user_id = '37d8d548-e668-462c-ab8d-9c7c5f33e196'"))
    print('Amit Instructor:', res.fetchall())
    await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
