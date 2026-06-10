from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


class HomeworkCreate(BaseModel):
    title: str
    description: str = ""
    subject_id: UUID | None = None
    course: str = ""
    course_name: str = ""
    student_group: str = ""
    class_name: str = ""
    academic_year: str = ""
    due_date: date | None = None
    max_points: int | None = None
    assigned_by: str = ""
    assigned_by_name: str = ""
    assigned_date: date | None = None
    status: str = "Published"
    gc_course_id: str = ""
    gc_course_work_id: str = ""
    gc_invite_code: str = ""
    gc_course_link: str = ""
    sync_status: str = "pending"
    sync_error: str | None = None
    gc_attempted_at: datetime | None = None


class HomeworkUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    subject_id: UUID | None = None
    course: str | None = None
    course_name: str | None = None
    student_group: str | None = None
    class_name: str | None = None
    academic_year: str | None = None
    due_date: date | None = None
    max_points: int | None = None
    assigned_by: str | None = None
    assigned_by_name: str | None = None
    assigned_date: date | None = None
    status: str | None = None
    gc_course_id: str | None = None
    gc_course_work_id: str | None = None
    gc_invite_code: str | None = None
    gc_course_link: str | None = None
    sync_status: str | None = None
    sync_error: str | None = None
    gc_attempted_at: datetime | None = None


class HomeworkResponse(BaseModel):
    id: UUID
    title: str
    description: str
    course: str
    course_name: str
    student_group: str
    class_name: str
    academic_year: str
    due_date: date | None
    max_points: int | None
    assigned_by: str
    assigned_by_name: str
    section_id: UUID | None = None
    subject_id: UUID | None = None
    created_by_id: UUID | None = None
    assigned_date: date
    status: str
    gc_course_id: str
    gc_course_work_id: str
    gc_invite_code: str
    gc_course_link: str
    sync_status: str
    sync_error: str | None
    gc_attempted_at: datetime | None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class HomeworkSubmissionCreate(BaseModel):
    homework_id: UUID
    student_id: UUID
    submission_text: str | None = None
    file_url: str | None = None


class HomeworkSubmissionResponse(BaseModel):
    id: UUID
    homework_id: UUID
    student_id: UUID
    student_name: str | None = None
    submission_text: str | None = None
    file_url: str | None = None
    submitted_at: datetime
    status: str
    marks: int | None = None
    graded_by: UUID | None = None
    graded_at: datetime | None = None
    remarks: str | None = None

    model_config = {"from_attributes": True}


class HomeworkGradeSubmission(BaseModel):
    marks: int
    remarks: str | None = None
