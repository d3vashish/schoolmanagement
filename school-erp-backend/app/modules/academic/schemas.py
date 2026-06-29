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
    is_current: bool = False

    model_config = {"from_attributes": True}


class ClassCreate(BaseModel):
    name: str
    order: int


class ClassResponse(BaseModel):
    id: UUID
    name: str
    order: int
    subject_count: int = 0

    model_config = {"from_attributes": True}


class SectionCreate(BaseModel):
    class_id: UUID
    name: str
    capacity: int
    academic_year_id: UUID
    class_teacher_id: Optional[UUID] = None


class SectionResponse(BaseModel):
    id: UUID
    class_id: UUID
    name: str
    capacity: int
    academic_year_id: UUID
    program: str = ""
    academic_year: str = ""
    class_teacher_id: Optional[UUID] = None

class SectionUpdate(BaseModel):
    name: Optional[str] = None
    capacity: Optional[int] = None
    class_id: Optional[UUID] = None
    class_teacher_id: Optional[UUID] = None

    model_config = {"from_attributes": True}


class SubjectCreate(BaseModel):
    name: str
    code: str | None = None
    is_graded: bool = True
    department: Optional[str] = None
    description: Optional[str] = None
    credit_hours: Optional[int] = None
    lab_fee_amount: Optional[int] = None
    grading_scheme_id: Optional[UUID] = None
    is_active: bool = True


class SubjectResponse(BaseModel):
    id: UUID
    name: str
    code: str | None = None
    is_graded: bool
    department: Optional[str] = None
    description: Optional[str] = None
    credit_hours: Optional[int] = None
    lab_fee_amount: Optional[int] = None
    grading_scheme_id: Optional[UUID] = None
    is_active: bool

    model_config = {"from_attributes": True}

class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    is_graded: Optional[bool] = None
    department: Optional[str] = None
    description: Optional[str] = None
    credit_hours: Optional[int] = None
    lab_fee_amount: Optional[int] = None
    grading_scheme_id: Optional[UUID] = None
    is_active: Optional[bool] = None


class ClassSubjectCreate(BaseModel):
    subject_id: UUID


class ClassSubjectResponse(BaseModel):
    id: UUID
    class_id: UUID
    subject_id: UUID
    subject_name: str = ""
    subject_code: str | None = None

    model_config = {"from_attributes": True}


class ClassDetailResponse(BaseModel):
    id: UUID
    name: str
    order: int
    subjects: list[ClassSubjectResponse] = []
    sections: list[SectionResponse] = []

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
    name: str | None = None
    date_of_birth: datetime | None = None
    admission_number: str
    aadhar_number: str | None = None
    student_group_name: str | None = None
    section_name: str | None = None
    guardian_name: str | None = None
    guardian_phone: str | None = None
    address: str | None = None
    email: str | None = None
    student_email_id: str | None = None
    student_email: str | None = None
    student_mobile_number: str | None = None
    student_mobile: str | None = None
    gender: str | None = None
    is_active: bool = True
    enabled: int | None = None
    student_name: str | None = None
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


class StudentFinancialResponse(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    admission_number: str
    student_group_name: str | None = None
    total_fees: float = 0
    paid_amount: float = 0
    due_amount: float = 0
    last_payment_date: datetime | None = None
    payment_status: str = "unknown"


class InstructorResponse(BaseModel):
    id: UUID | None = None
    user_id: UUID
    email: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    employee_id: str | None = None
    department: str | None = None
    qualification: str | None = None
    is_active: bool = True

    model_config = {"from_attributes": True}


class StudentCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str
    aadhar_number: str
    date_of_birth: date | None = None
    class_id: str | None = None
    academic_year_id: str | None = None
    section_id: str | None = None 
    guardian_name: str | None = None
    guardian_phone: str | None = None
    address: str | None = None


class StudentUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    aadhar_number: str | None = None
    date_of_birth: date | None = None
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
    class_teacher_id: UUID | None = None 
    students: list[StudentProfileResponse] = []

    model_config = {"from_attributes": True}


class EnrollmentCreate(BaseModel):
    student_id: UUID
    class_id: UUID
    section_id: UUID | None = None
    academic_year_id: UUID
    roll_number: str | None = None

class EnrollmentResponse(BaseModel):
    id: UUID
    student_id: UUID
    student_name: str | None = None
    class_id: UUID
    class_name: str | None = None
    section_id: UUID | None = None
    section_name: str | None = None
    academic_year_id: UUID
    academic_year_name: str | None = None
    roll_number: str | None = None
    status: str
    enrolled_at: datetime
    left_at: datetime | None = None

    model_config = {"from_attributes": True}

class EnrollmentUpdate(BaseModel):
    section_id: UUID | None = None
    roll_number: str | None = None
    status: str | None = None
    left_at: datetime | None = None


class TransferCreate(BaseModel):
    student_id: UUID
    to_class_id: UUID
    to_section_id: UUID | None = None
    to_academic_year_id: UUID
    roll_number: str | None = None


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
    id: UUID
    instructor_id: UUID
    section_id: UUID
    subject_id: UUID
    class_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
