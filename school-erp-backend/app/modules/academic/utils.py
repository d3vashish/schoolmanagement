from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.academic.models import Holiday


async def is_working_day(d: date, db: AsyncSession) -> bool:
    if d.weekday() == 6:
        return False
    result = await db.execute(select(Holiday).where(Holiday.date == d))
    return result.scalar_one_or_none() is None


def generate_admission_number(aadhar_number: str, first_name: str, last_name: str) -> str:
    """
    Format: OC + last 4 digits of the student's Aadhar number + first letter
    of first name + first letter of last name, e.g. Chetan Deshmukh with
    Aadhar ...4567 -> OC4567CD.

    Collisions (two students sharing both initials AND the same last-4 Aadhar
    digits) are accepted as an acceptable rare risk per product decision -
    no uniqueness retry/suffix logic here.
    """
    last_four = (aadhar_number or "")[-4:]
    initial_first = (first_name or "?")[0].upper()
    initial_last = (last_name or "?")[0].upper()
    return f"OC{last_four}{initial_first}{initial_last}"