from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class ExamCreate(BaseModel):
    name: str
    academic_year_id: UUID
    class_id: UUID
    grading_scheme_id: UUID | None = None
    start_date: date
    end_date: date


class ExamResponse(BaseModel):
    id: UUID
    name: str
    academic_year_id: UUID
    class_id: UUID
    grading_scheme_id: UUID | None
    start_date: date
    end_date: date
    status: str

    model_config = {"from_attributes": True}


class MarksEntry(BaseModel):
    student_id: UUID
    subject_id: UUID
    marks: Decimal | None = None
    max_marks: Decimal
    is_absent: bool = False


class MarksUpdate(BaseModel):
    marks: Decimal | None = None
    is_absent: bool = False
    version: int


class ExamResultResponse(BaseModel):
    id: UUID
    exam_id: UUID
    student_id: UUID
    subject_id: UUID
    marks: Decimal | None
    max_marks: Decimal
    is_absent: bool
    status: str
    version: int

    model_config = {"from_attributes": True}


class AggregateResponse(BaseModel):
    exam_id: UUID
    student_id: UUID
    total_marks: Decimal
    max_total: Decimal
    percentage: Decimal
    grade: str | None
    rank: int | None

    model_config = {"from_attributes": True}


class GradingSchemeCreate(BaseModel):
    name: str
    grade_a_min: Decimal | None = None
    grade_b_min: Decimal | None = None
    grade_c_min: Decimal | None = None
    grade_d_min: Decimal | None = None
    grade_e_min: Decimal | None = None


class GradingSchemeResponse(BaseModel):
    id: UUID
    name: str
    grade_a_min: Decimal | None
    grade_b_min: Decimal | None
    grade_c_min: Decimal | None
    grade_d_min: Decimal | None
    grade_e_min: Decimal | None

    model_config = {"from_attributes": True}


class ReportCardResponse(BaseModel):
    id: UUID
    exam_id: UUID
    student_id: UUID
    file_url: str
    generated_at: date | None

    model_config = {"from_attributes": True}
