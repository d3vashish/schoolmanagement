from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    user_id: str
    role: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str


class OTPRequest(BaseModel):
    phone: str


class OTPVerify(BaseModel):
    phone: str
    otp: str


class UserCreate(BaseModel):
    email: str
    password: str
    role: str
    first_name: str
    last_name: str
    phone: str | None = None
    date_of_birth: date | None = None
    admission_number: str | None = None
    class_id: str | None = None
    employee_id: str | None = None
    department: str | None = None
    qualification: str | None = None
    guardian_name: str | None = None
    guardian_phone: str | None = None
    address: str | None = None


class UserUpdate(BaseModel):
    email: str | None = None
    password: str | None = None
    role: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    date_of_birth: date | None = None
    class_id: str | None = None
    employee_id: str | None = None
    department: str | None = None
    qualification: str | None = None
    guardian_name: str | None = None
    guardian_phone: str | None = None
    address: str | None = None
    is_active: bool | None = None


class UserResponse(BaseModel):
    id: UUID
    email: str | None = None
    phone: str | None = None
    role: str
    is_active: bool
    first_name: str | None = None
    last_name: str | None = None
    employee_id: str | None = None
    department: str | None = None
    qualification: str | None = None
    admission_number: str | None = None
    class_id: str | None = None
    guardian_name: str | None = None
    guardian_phone: str | None = None
    address: str | None = None
    date_of_birth: date | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
