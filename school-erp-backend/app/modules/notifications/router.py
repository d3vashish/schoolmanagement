from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, role_required
from app.modules.notifications.schemas import (
    NotificationCreate,
    NotificationResponse,
    UnreadCountResponse,
)
from app.modules.notifications.service import (
    create_notification,
    get_notifications_for_user,
    get_unread_count,
    mark_all_as_read,
    mark_as_read,
)

admin_teacher = [role_required("super_admin", "principal", "teacher")]

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationResponse])
async def list_notifications(
    unread_only: bool = Query(default=False),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_notifications_for_user(
        current_user, db, unread_only=unread_only, limit=limit, offset=offset
    )


@router.get("/unread-count", response_model=UnreadCountResponse)
async def unread_count(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = await get_unread_count(current_user, db)
    return UnreadCountResponse(unread_count=count)


@router.patch("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def read_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await mark_as_read(notification_id, current_user["id"], db)


@router.post("/read-all")
async def read_all(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = await mark_all_as_read(current_user, db)
    return {"marked_read": count}


@router.post("", response_model=NotificationResponse, dependencies=admin_teacher)
async def create(
    body: NotificationCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await create_notification(
        title=body.title,
        message=body.message,
        type=body.type,
        link=body.link,
        user_id=str(body.user_id) if body.user_id else None,
        role=body.role,
        section_id=str(body.section_id) if body.section_id else None,
        created_by=current_user["id"],
        db=db,
    )