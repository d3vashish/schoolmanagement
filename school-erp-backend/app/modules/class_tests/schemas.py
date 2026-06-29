from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class ClassTestCreate(BaseModel):
    title: str
    description: str | None = None
    section_id: UUID
    test_date: date | None = None
    max_marks: Decimal


class ClassTestUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    test_date: date | None = None
    max_marks: Decimal | None = None


class ClassTestResponse(BaseModel):
    id: UUID
    title: str
    description: str | None
    section_id: UUID
    section_name: str | None = None
    class_name: str | None = None
    test_date: date | None
    max_marks: Decimal
    created_by: UUID | None
    created_at: datetime | None = None
    student_count: int = 0
    entered_count: int = 0

    model_config = {"from_attributes": True}


class MarkEntry(BaseModel):
    student_id: UUID
    marks_obtained: Decimal | None = None


class BulkMarksUpdate(BaseModel):
    marks: list[MarkEntry]


class StudentMarkResponse(BaseModel):
    student_id: UUID
    student_name: str
    admission_number: str | None
    marks_obtained: Decimal | None


class ClassTestDetailResponse(ClassTestResponse):
    students: list[StudentMarkResponse] = []