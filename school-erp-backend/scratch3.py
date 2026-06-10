import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def main():
    engine = create_async_engine('postgresql+asyncpg://erp_user:erp_pass@localhost:5432/school_erp')
    async with engine.begin() as conn:
        res = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'teacher_assignments' ORDER BY ordinal_position;"))
        print('Columns:', [r[0] for r in res.fetchall()])
        res2 = await conn.execute(text("SELECT * FROM teacher_assignments WHERE instructor_id = '37d8d548-e668-462c-ab8d-9c7c5f33e196';"))
        print('Amit assignments:', res2.fetchall())

if __name__ == '__main__':
    asyncio.run(main())
