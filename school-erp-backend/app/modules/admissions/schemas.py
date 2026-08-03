from datetime import date, datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class AdmissionCreate(BaseModel):
    # Student details
    applicant_name: str
    date_of_birth: date | None = None
    gender: str | None = None
    phone: str | None = None
    applicant_phone: str
    applicant_email: str | None = None
    address: str | None = None
    aadhar_number: str | None = None
    category: str | None = None
    caste: str | None = None
    religion: str | None = None
    nationality: str | None = None
    blood_group: str | None = None

    # Academic
    class_id: UUID
    academic_year_id: UUID
    previous_school: str | None = None
    previous_class: str | None = None
    tc_number: str | None = None

    # Father details
    father_name: str | None = None
    father_phone: str | None = None
    father_email: str | None = None
    father_occupation: str | None = None
    father_aadhar: str | None = None

    # Mother details
    mother_name: str | None = None
    mother_phone: str | None = None
    mother_email: str | None = None
    mother_occupation: str | None = None
    mother_aadhar: str | None = None

    # Guardian (if different)
    parent_name: str | None = None
    parent_phone: str | None = None
    parent_email: str | None = None

    remarks: str | None = None


class AdmissionResponse(BaseModel):
    id: UUID
    applicant_name: str
    applicant_phone: str
    applicant_email: str | None = None
    date_of_birth: datetime | None = None
    gender: str | None = None
    phone: str | None = None
    address: str | None = None
    aadhar_number: str | None = None
    category: str | None = None
    caste: str | None = None
    religion: str | None = None
    nationality: str | None = None
    blood_group: str | None = None
    class_id: UUID
    academic_year_id: UUID
    status: str
    previous_school: str | None = None
    previous_class: str | None = None
    tc_number: str | None = None
    father_name: str | None = None
    father_phone: str | None = None
    father_email: str | None = None
    father_occupation: str | None = None
    father_aadhar: str | None = None
    mother_name: str | None = None
    mother_phone: str | None = None
    mother_email: str | None = None
    mother_occupation: str | None = None
    mother_aadhar: str | None = None
    parent_name: str | None = None
    parent_phone: str | None = None
    parent_email: str | None = None
    remarks: str | None = None
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
    verified_by: UUID | None = None
    verified_at: datetime | None = None

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
