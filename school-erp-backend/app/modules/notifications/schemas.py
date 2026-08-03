from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, model_validator


class NotificationCreate(BaseModel):
    title: str
    message: str
    type: str = "GENERAL"
    link: str | None = None

    # Exactly one of these should be set by the caller.
    user_id: UUID | None = None
    role: str | None = None
    section_id: UUID | None = None

    @model_validator(mode="after")
    def _check_single_target(self):
        targets = [self.user_id, self.role, self.section_id]
        provided = [t for t in targets if t is not None]
        if len(provided) != 1:
            raise ValueError("Exactly one of user_id, role, or section_id must be provided")
        return self


class NotificationResponse(BaseModel):
    id: UUID
    title: str
    message: str
    type: str
    link: str | None
    target_type: str
    user_id: UUID | None = None
    role: str | None = None
    section_id: UUID | None = None
    created_by: UUID | None = None
    created_at: datetime
    is_read: bool = False

    model_config = {"from_attributes": True}


class UnreadCountResponse(BaseModel):
    unread_count: int