from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class TimetableSlotCreate(BaseModel):
    section_id: UUID
    subject_id: UUID
    teacher_id: UUID
    day_of_week: int
    period_no: int
    academic_year_id: UUID


class TimetableSlotResponse(BaseModel):
    id: UUID
    section_id: UUID
    subject_id: UUID
    teacher_id: UUID
    day_of_week: int
    period_no: int
    academic_year_id: UUID
    is_published: bool
    teacher_name: Optional[str] = None
    subject_name: Optional[str] = None

    model_config = {"from_attributes": True}
