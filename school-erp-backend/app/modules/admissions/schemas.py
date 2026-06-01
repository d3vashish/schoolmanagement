from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AdmissionCreate(BaseModel):
    applicant_name: str
    applicant_phone: str
    applicant_email: str | None = None
    date_of_birth: datetime | None = None
    class_id: UUID
    academic_year_id: UUID
    parent_name: str | None = None
    parent_phone: str | None = None
    address: str | None = None
    previous_school: str | None = None
    remarks: str | None = None


class AdmissionResponse(BaseModel):
    id: UUID
    applicant_name: str
    applicant_phone: str
    applicant_email: str | None
    date_of_birth: datetime | None
    class_id: UUID
    academic_year_id: UUID
    status: str
    parent_name: str | None
    parent_phone: str | None
    address: str | None
    previous_school: str | None
    remarks: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TransitionRequest(BaseModel):
    status: str


class DocumentResponse(BaseModel):
    id: UUID
    admission_id: UUID
    doc_type: str
    file_key: str
    status: str
    verified_by: UUID | None
    verified_at: datetime | None

    model_config = {"from_attributes": True}
