from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class TimetableSlotCreate(BaseModel):
    section_id: UUID
    subject_id: UUID
    instructor_id: UUID
    day_of_week: int
    period_no: int
    academic_year_id: UUID


class TimetableSlotUpdate(BaseModel):
    section_id: Optional[UUID] = None
    subject_id: Optional[UUID] = None
    instructor_id: Optional[UUID] = None
    day_of_week: Optional[int] = None
    period_no: Optional[int] = None
    academic_year_id: Optional[UUID] = None


class TimetableSlotResponse(BaseModel):
    id: UUID
    section_id: UUID
    subject_id: UUID
    instructor_id: UUID
    day_of_week: int
    period_no: int
    academic_year_id: UUID
    is_published: bool
    instructor_name: Optional[str] = None
    subject_name: Optional[str] = None

    model_config = {"from_attributes": True}
