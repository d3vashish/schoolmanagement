from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class AcademicYearCreate(BaseModel):
    name: str
    start_date: date
    end_date: date
    is_active: bool = False


class AcademicYearResponse(BaseModel):
    id: UUID
    name: str
    start_date: date
    end_date: date
    is_active: bool

    model_config = {"from_attributes": True}


class ClassCreate(BaseModel):
    name: str
    order: int


class ClassResponse(BaseModel):
    id: UUID
    name: str
    order: int

    model_config = {"from_attributes": True}


class SectionCreate(BaseModel):
    class_id: UUID
    name: str
    capacity: int
    academic_year_id: UUID


class SectionResponse(BaseModel):
    id: UUID
    class_id: UUID
    name: str
    capacity: int
    academic_year_id: UUID
    program: str = ""
    academic_year: str = ""

    model_config = {"from_attributes": True}


class SubjectCreate(BaseModel):
    name: str
    code: str
    is_graded: bool = True


class SubjectResponse(BaseModel):
    id: UUID
    name: str
    code: str
    is_graded: bool

    model_config = {"from_attributes": True}


class HolidayCreate(BaseModel):
    date: date
    name: str
    holiday_type: str


class HolidayResponse(BaseModel):
    id: UUID
    date: date
    name: str
    holiday_type: str

    model_config = {"from_attributes": True}


class PromotionRequest(BaseModel):
    student_ids: list[UUID]
    from_academic_year_id: UUID
    to_academic_year_id: UUID
    to_class_id: UUID


class ProgressionResponse(BaseModel):
    id: UUID
    student_id: UUID
    from_class_id: UUID
    to_class_id: UUID
    from_academic_year_id: UUID
    to_academic_year_id: UUID
    is_retained: bool
    promoted_by: UUID
    promoted_at: datetime

    model_config = {"from_attributes": True}


class StudentProfileResponse(BaseModel):
    id: UUID
    user_id: UUID
    first_name: str
    last_name: str
    date_of_birth: datetime | None = None
    admission_number: str
    class_id: UUID | None = None
    student_group_name: str | None = None
    guardian_name: str | None = None
    guardian_phone: str | None = None
    address: str | None = None
    email: str | None = None
    is_active: bool = True
    creation: datetime | None = None

    model_config = {"from_attributes": True}


class PaginatedStudentResponse(BaseModel):
    data: list[StudentProfileResponse]
    total: int
    page: int
    per_page: int
    total_pages: int


class StudentSearchResponse(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    admission_number: str
    class_id: UUID | None = None
    student_group_name: str | None = None
    section_name: str | None = None
    email: str | None = None

    model_config = {"from_attributes": True}


class InstructorResponse(BaseModel):
    id: UUID
    user_id: UUID
    email: str | None = None
    first_name: str
    last_name: str
    employee_id: str
    department: str | None = None
    qualification: str | None = None
    is_active: bool = True

    model_config = {"from_attributes": True}


class StudentCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str
    date_of_birth: date | None = None
    class_id: str | None = None
    guardian_name: str | None = None
    guardian_phone: str | None = None
    address: str | None = None


class StudentUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    date_of_birth: date | None = None
    class_id: str | None = None
    guardian_name: str | None = None
    guardian_phone: str | None = None
    address: str | None = None
    is_active: bool | None = None


class InstructorCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str
    employee_id: str | None = None
    department: str | None = None
    qualification: str | None = None


class InstructorUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    employee_id: str | None = None
    department: str | None = None
    qualification: str | None = None
    is_active: bool | None = None


class SectionDetailResponse(BaseModel):
    id: UUID
    class_id: UUID
    name: str
    capacity: int
    academic_year_id: UUID
    program: str = ""
    academic_year: str = ""
    students: list[StudentProfileResponse] = []

    model_config = {"from_attributes": True}


class EnrollmentCreate(BaseModel):
    student_id: UUID
    class_id: UUID
    academic_year_id: UUID | None = None


class EnrollmentResponse(BaseModel):
    id: UUID
    student_id: UUID
    student_name: str | None = None
    class_id: UUID | None = None
    class_name: str | None = None
    academic_year_id: UUID | None = None
    academic_year_name: str | None = None
    enrollment_date: datetime | None = None

    model_config = {"from_attributes": True}


class TeacherAssignmentCreate(BaseModel):
    instructor_id: str
    section_id: str
    subject_id: str
    class_id: str


class TeacherAssignmentUpdate(BaseModel):
    instructor_id: Optional[str] = None
    section_id: Optional[str] = None
    subject_id: Optional[str] = None
    class_id: Optional[str] = None


class TeacherAssignmentResponse(BaseModel):
    id: str
    instructor_id: str
    section_id: str
    subject_id: str
    class_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
