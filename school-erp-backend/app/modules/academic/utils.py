from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.academic.models import Holiday


async def is_working_day(d: date, db: AsyncSession) -> bool:
    if d.weekday() == 6:
        return False
    result = await db.execute(select(Holiday).where(Holiday.date == d))
    return result.scalar_one_or_none() is None
