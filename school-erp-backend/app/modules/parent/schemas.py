from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class ChildResponse(BaseModel):
    student_id: UUID
    first_name: str
    last_name: str
    class_name: str | None = None
    admission_number: str
    relationship: str | None = None

    model_config = {"from_attributes": True}


class AttendanceRecord(BaseModel):
    date: date
    status: str
    period_no: int | None = None

    model_config = {"from_attributes": True}


class FeeDueResponse(BaseModel):
    invoice_id: UUID
    installment_name: str
    gross_amount: Decimal
    discount_amount: Decimal
    net_amount: Decimal
    due_date: date
    status: str
    late_fee: Decimal

    model_config = {"from_attributes": True}


class ResultResponse(BaseModel):
    exam_name: str
    subject_name: str
    marks: Decimal | None = None
    max_marks: Decimal
    is_absent: bool
    grade: str | None = None

    model_config = {"from_attributes": True}


class AggregateResponse(BaseModel):
    exam_name: str
    total_marks: Decimal
    max_total: Decimal
    percentage: Decimal
    grade: str | None = None
    rank: int | None = None

    model_config = {"from_attributes": True}


class CircularCreate(BaseModel):
    title: str
    body: str
    attachment_url: str | None = None
    target_class_id: str | None = None
    publish_now: bool = False


class CircularUpdate(BaseModel):
    title: str | None = None
    body: str | None = None
    attachment_url: str | None = None
    target_class_id: str | None = None
    publish_now: bool | None = None


class CircularResponse(BaseModel):
    id: UUID
    title: str
    body: str
    attachment_url: str | None = None
    target_class_id: str | None = None
    published_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    id: UUID
    sender_id: UUID
    subject: str
    body: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    subject: str
    body: str


class NotificationPrefsUpdate(BaseModel):
    sms_enabled: bool | None = None
    email_enabled: bool | None = None
    push_enabled: bool | None = None


class NotificationPrefsResponse(BaseModel):
    sms_enabled: bool
    email_enabled: bool
    push_enabled: bool

    model_config = {"from_attributes": True}


class EligibilityResponse(BaseModel):
    student_id: UUID
    working_days: int
    approved_leaves: int
    present_days: int
    percentage: float
    is_eligible: bool
