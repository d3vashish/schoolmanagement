import asyncio
from app.core.database import get_db
from app.modules.timetable.models import TimetableSlot
from app.modules.auth.models import StaffProfile
from app.modules.academic.models import Subject
from sqlalchemy import select

async def main():
    async for db in get_db():
        q = (
            select(TimetableSlot, StaffProfile, Subject)
            .outerjoin(StaffProfile, StaffProfile.user_id == TimetableSlot.teacher_id)
            .outerjoin(Subject, Subject.id == TimetableSlot.subject_id)
        )
        res = await db.execute(q)
        for slot, staff, subject in res:
            name = f"{staff.first_name} {staff.last_name}" if staff else "Unknown"
            subj_name = subject.name if subject else "Unknown"
            if name == "Amit Sharma":
                print(f"Day:{slot.day_of_week} Subj:{subj_name} Sec:{slot.section_id}")
        break

asyncio.run(main())
