from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


class AttendanceMark(BaseModel):
    student_id: str
    date: date
    period_no: int | None = None
    status: str


class AttendanceResponse(BaseModel):
    id: UUID
    student_id: UUID
    date: date
    period_no: int | None
    status: str
    marked_by: UUID
    is_corrected: bool

    model_config = {"from_attributes": True}


class LeaveTypeCreate(BaseModel):
    name: str
    is_paid: bool = True


class LeaveTypeResponse(BaseModel):
    id: UUID
    name: str
    is_paid: bool

    model_config = {"from_attributes": True}


class LeaveApply(BaseModel):
    leave_type_id: UUID
    start_date: date
    end_date: date
    reason: str | None = None


class LeaveResponse(BaseModel):
    id: UUID
    student_id: UUID
    leave_type_id: UUID
    start_date: date
    end_date: date
    reason: str | None
    status: str
    approved_by: UUID | None
    approved_at: date | None

    model_config = {"from_attributes": True}


class LeaveUpdate(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    reason: str | None = None
    status: str | None = None


class EligibilityResponse(BaseModel):
    student_id: UUID
    working_days: int
    approved_leaves: int
    present_days: int
    percentage: float
    is_eligible: bool


class AttendanceOverviewItem(BaseModel):
    id: UUID
    student_id: UUID
    date: date
    period_no: int | None = None
    status: str
    student_group: str | None = None

    model_config = {"from_attributes": True}
