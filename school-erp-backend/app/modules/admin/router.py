from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import role_required
from app.core.security import hash_password
from app.modules.admin.models import SchoolSetting
from app.modules.admin.schemas import (
    AdminDashboardStats,
    AuditLogResponse,
    PaginatedResponse,
    ResetPasswordRequest,
    SettingResponse,
    SettingUpdate,
    UserCreateAdmin,
    UserResponseAdmin,
    UserUpdateAdmin,
)
from app.modules.audit.models import AuditLog
from app.modules.auth.models import ROLES, User

router = APIRouter(prefix="/admin", tags=["admin"])


async def _get_current_super_admin(
    current_user: dict = role_required("super_admin"),
) -> dict:
    return current_user


@router.get("/dashboard", response_model=AdminDashboardStats)
async def get_admin_dashboard(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(_get_current_super_admin),
):
    total_users_result = await db.execute(
        select(func.count(User.id)).where(User.deleted_at.is_(None))
    )
    total_users = total_users_result.scalar() or 0

    roles_result = await db.execute(
        select(User.role, func.count(User.id)).where(User.deleted_at.is_(None)).group_by(User.role)
    )
    users_by_role = {row[0]: row[1] for row in roles_result.fetchall()}

    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    active_result = await db.execute(
        select(func.count(AuditLog.changed_by.distinct()))
        .where(AuditLog.created_at >= cutoff)
    )
    active_today = active_result.scalar() or 0

    return AdminDashboardStats(
        total_users=total_users,
        users_by_role=users_by_role,
        active_today=active_today,
        storage_used_mb=0.0,
    )


@router.get("/users", response_model=PaginatedResponse)
async def list_users_admin(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    role: str | None = None,
    status: bool | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(_get_current_super_admin),
):
    q = select(User).where(User.deleted_at.is_(None))
    if role:
        q = q.where(User.role == role)
    if status is not None:
        q = q.where(User.is_active == status)
    if search:
        q = q.where(User.email.ilike(f"%{search}%"))
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    q = q.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q.options(
        selectinload(User.student_profiles),
        selectinload(User.staff_profiles),
        selectinload(User.parent_profiles),
    ))
    users = result.scalars().all()
    data = []
    for u in users:
        profile = None
        if u.role == "student" and u.student_profiles:
            profile = u.student_profiles[0]
        elif u.role in ("teacher", "accountant", "librarian") and u.staff_profiles:
            profile = u.staff_profiles[0]
        elif u.role == "parent" and u.parent_profiles:
            profile = u.parent_profiles[0]
        data.append(UserResponseAdmin(
            id=u.id,
            email=u.email,
            phone=u.phone,
            role=u.role,
            is_active=u.is_active,
            first_name=getattr(profile, "first_name", None),
            last_name=getattr(profile, "last_name", None),
            created_at=u.created_at,
        ))
    return PaginatedResponse(data=[d.model_dump() for d in data], total=total, page=page, page_size=page_size)


@router.post("/users", response_model=UserResponseAdmin, status_code=status.HTTP_201_CREATED)
async def create_user_admin(
    body: UserCreateAdmin,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(_get_current_super_admin),
):
    existing = await db.execute(select(User).where(User.email == body.email, User.deleted_at.is_(None)))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    if body.role not in ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid role. Must be one of: {', '.join(ROLES)}")
    user = User(
        email=body.email,
        phone=body.phone,
        hashed_pw=hash_password(body.password),
        role=body.role,
        is_active=body.is_active,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return UserResponseAdmin(
        id=user.id,
        email=user.email,
        phone=user.phone,
        role=user.role,
        is_active=user.is_active,
        first_name=body.first_name,
        last_name=body.last_name,
        created_at=user.created_at,
    )


@router.get("/users/{user_id}", response_model=UserResponseAdmin)
async def get_user_admin(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(_get_current_super_admin),
):
    user = await db.get(User, user_id, options=[
        selectinload(User.student_profiles),
        selectinload(User.staff_profiles),
        selectinload(User.parent_profiles),
    ])
    if not user or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    profile = None
    if user.role == "student" and user.student_profiles:
        profile = user.student_profiles[0]
    elif user.role in ("teacher", "accountant", "librarian") and user.staff_profiles:
        profile = user.staff_profiles[0]
    elif user.role == "parent" and user.parent_profiles:
        profile = user.parent_profiles[0]
    return UserResponseAdmin(
        id=user.id,
        email=user.email,
        phone=user.phone,
        role=user.role,
        is_active=user.is_active,
        first_name=getattr(profile, "first_name", None),
        last_name=getattr(profile, "last_name", None),
        created_at=user.created_at,
    )


@router.put("/users/{user_id}", response_model=UserResponseAdmin)
async def update_user_admin(
    user_id: str,
    body: UserUpdateAdmin,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(_get_current_super_admin),
):
    user = await db.get(User, user_id)
    if not user or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if body.email is not None:
        user.email = body.email
    if body.phone is not None:
        user.phone = body.phone
    if body.role is not None:
        if body.role not in ROLES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid role. Must be one of: {', '.join(ROLES)}")
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active
    await db.flush()
    await db.refresh(user, [
        "student_profiles",
        "staff_profiles",
        "parent_profiles",
    ])
    return UserResponseAdmin(
        id=user.id,
        email=user.email,
        phone=user.phone,
        role=user.role,
        is_active=user.is_active,
        first_name=body.first_name,
        last_name=body.last_name,
        created_at=user.created_at,
    )


@router.patch("/users/{user_id}/status", response_model=UserResponseAdmin)
async def toggle_user_status(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(_get_current_super_admin),
):
    if user_id == current_user["id"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot disable your own account")
    user = await db.get(User, user_id)
    if not user or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_active = not user.is_active
    await db.flush()
    return UserResponseAdmin(
        id=user.id,
        email=user.email,
        phone=user.phone,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
    )


@router.post("/users/{user_id}/reset-password", status_code=status.HTTP_200_OK)
async def reset_user_password(
    user_id: str,
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(_get_current_super_admin),
):
    user = await db.get(User, user_id)
    if not user or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.hashed_pw = hash_password(body.new_password)
    await db.flush()
    return {"message": "Password reset successful"}


@router.get("/settings", response_model=list[SettingResponse])
async def get_settings(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(_get_current_super_admin),
):
    result = await db.execute(select(SchoolSetting).order_by(SchoolSetting.key))
    settings = result.scalars().all()
    return [SettingResponse(key=s.key, value=s.value, updated_at=s.updated_at) for s in settings]


@router.put("/settings", response_model=list[SettingResponse])
async def update_settings(
    body: list[SettingUpdate],
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(_get_current_super_admin),
):
    results = []
    for item in body:
        existing = await db.execute(
            select(SchoolSetting).where(SchoolSetting.key == item.key)
        )
        setting = existing.scalar_one_or_none()
        if setting:
            setting.value = item.value
        else:
            setting = SchoolSetting(key=item.key, value=item.value)
            db.add(setting)
        results.append(setting)
    await db.flush()
    for s in results:
        await db.refresh(s)
    return [SettingResponse(key=s.key, value=s.value, updated_at=s.updated_at) for s in results]


@router.get("/audit/log", response_model=PaginatedResponse)
async def get_audit_log(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    action_type: str | None = None,
    user_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(_get_current_super_admin),
):
    q = select(AuditLog)
    if action_type:
        q = q.where(AuditLog.action == action_type)
    if user_id:
        q = q.where(AuditLog.changed_by == user_id)
    if date_from:
        q = q.where(AuditLog.created_at >= datetime.fromisoformat(date_from))
    if date_to:
        q = q.where(AuditLog.created_at <= datetime.fromisoformat(date_to))
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    q = q.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    logs = result.scalars().all()
    data = []
    for log in logs:
        data.append(AuditLogResponse(
            id=log.id,
            table_name=log.table_name,
            record_id=log.record_id,
            action=log.action,
            changed_by=log.changed_by,
            summary=f"{log.action} {log.table_name}",
            created_at=log.created_at,
        ))
    return PaginatedResponse(data=[d.model_dump() for d in data], total=total, page=page, page_size=page_size)