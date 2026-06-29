from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.shared.models import SoftDeleteMixin, TimestampMixin

ROLES = [
    "super_admin",
    "principal",
    "teacher",
    "accountant",
    "librarian",
    "parent",
    "student",
]


class User(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "users"

    email = Column(String(255), unique=True, index=True, nullable=True)
    phone = Column(String(20), unique=True, index=True, nullable=True)
    hashed_pw = Column(String(255), nullable=True)
    role = Column(String(20), nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    last_login = Column(DateTime(timezone=True), nullable=True)

    student_profiles = relationship("StudentProfile", back_populates="user", uselist=True)
    staff_profiles = relationship("StaffProfile", back_populates="user", uselist=True)
    parent_profiles = relationship("ParentProfile", back_populates="user", uselist=True)


class StudentProfile(Base, TimestampMixin):
    __tablename__ = "student_profiles"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    date_of_birth = Column(DateTime(timezone=True), nullable=True)
    admission_number = Column(String(50), unique=True, nullable=False)
    aadhar_number = Column(String(12), nullable=False)
    guardian_name = Column(String(200), nullable=True)
    guardian_phone = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)

    user = relationship("User", back_populates="student_profiles")


class StaffProfile(Base, TimestampMixin):
    __tablename__ = "staff_profiles"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    employee_id = Column(String(50), unique=True, nullable=False)
    designation = Column(String(100), nullable=True)
    department = Column(String(100), nullable=True)
    qualification = Column(String(200), nullable=True)
    joining_date = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="staff_profiles")


class ParentProfile(Base, TimestampMixin):
    __tablename__ = "parent_profiles"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    # DEPRECATED: will be removed in migration — use ParentStudentLink instead
    student_id = Column(UUID(as_uuid=True), ForeignKey("student_profiles.id"), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)

    user = relationship("User", back_populates="parent_profiles")
