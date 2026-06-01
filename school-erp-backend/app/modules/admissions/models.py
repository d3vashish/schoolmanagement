import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.shared.models import TimestampMixin

REQUIRED_DOCS = [
    "birth_certificate",
    "address_proof",
    "previous_marksheet",
    "passport_photo",
    "transfer_certificate",
]

ALLOWED_TRANSITIONS = {
    "INQUIRY": ["APPLICATION_SUBMITTED"],
    "APPLICATION_SUBMITTED": ["SHORTLISTED", "REJECTED"],
    "SHORTLISTED": ["ASSESSMENT_SCHEDULED"],
    "ASSESSMENT_SCHEDULED": ["OFFERED", "REJECTED"],
    "OFFERED": ["ACCEPTED", "DECLINED"],
    "ACCEPTED": ["DOCUMENTS_PENDING"],
    "DOCUMENTS_PENDING": ["DOCUMENTS_VERIFIED"],
    "DOCUMENTS_VERIFIED": ["FEE_PENDING"],
    "FEE_PENDING": ["ENROLLED"],
}


def can_transition(current: str, next_status: str) -> bool:
    return next_status in ALLOWED_TRANSITIONS.get(current, [])


class Admission(Base, TimestampMixin):
    __tablename__ = "admissions"

    applicant_name = Column(String(200), nullable=False)
    applicant_phone = Column(String(20), nullable=False)
    applicant_email = Column(String(255), nullable=True)
    date_of_birth = Column(DateTime(timezone=True), nullable=True)
    class_id = Column(UUID(as_uuid=True), ForeignKey("academic_classes.id"), nullable=False)
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False)
    status = Column(String(30), nullable=False, default="INQUIRY", index=True)
    parent_name = Column(String(200), nullable=True)
    parent_phone = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    previous_school = Column(String(200), nullable=True)
    remarks = Column(Text, nullable=True)

    documents = relationship("AdmissionDocument", back_populates="admission")


class AdmissionDocument(Base, TimestampMixin):
    __tablename__ = "admission_documents"

    admission_id = Column(UUID(as_uuid=True), ForeignKey("admissions.id"), nullable=False)
    doc_type = Column(String(50), nullable=False)
    file_key = Column(String(500), nullable=False)
    status = Column(String(20), nullable=False, default="PENDING")
    verified_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)

    admission = relationship("Admission", back_populates="documents")
