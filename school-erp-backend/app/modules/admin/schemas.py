from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class UserCreateAdmin(BaseModel):
    email: str
    password: str
    role: str
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    is_active: bool = True


class UserUpdateAdmin(BaseModel):
    email: str | None = None
    role: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    is_active: bool | None = None


class UserResponseAdmin(BaseModel):
    id: UUID
    email: str | None = None
    phone: str | None = None
    role: str
    is_active: bool
    first_name: str | None = None
    last_name: str | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class ResetPasswordRequest(BaseModel):
    new_password: str


class SettingUpdate(BaseModel):
    key: str
    value: str


class SettingResponse(BaseModel):
    key: str
    value: str | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class AuditLogResponse(BaseModel):
    id: UUID
    table_name: str
    record_id: UUID
    action: str
    changed_by: UUID | None = None
    summary: str | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class PaginatedResponse(BaseModel):
    data: list
    total: int
    page: int
    page_size: int


class AdminDashboardStats(BaseModel):
    total_users: int
    users_by_role: dict
    active_today: int
    storage_used_mb: float
