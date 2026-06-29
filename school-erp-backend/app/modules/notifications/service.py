from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notifications.models import (
    TARGET_ROLE,
    TARGET_SECTION,
    TARGET_USER,
    Notification,
    NotificationRead,
)


async def create_notification(
    title: str,
    message: str,
    db: AsyncSession,
    type: str = "GENERAL",
    link: str | None = None,
    user_id: str | None = None,
    role: str | None = None,
    section_id: str | None = None,
    created_by: str | None = None,
) -> Notification:
    """Create a single notification targeted at exactly one of user/role/section.

    Intended to be called from other modules' services (attendance, fees, etc.)
    as well as from the notifications router for manual/admin broadcasts.
    """
    provided = [v for v in (user_id, role, section_id) if v is not None]
    if len(provided) != 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exactly one of user_id, role, or section_id must be provided",
        )

    if user_id is not None:
        target_type = TARGET_USER
    elif role is not None:
        target_type = TARGET_ROLE
    else:
        target_type = TARGET_SECTION

    notification = Notification(
        title=title,
        message=message,
        type=type,
        link=link,
        target_type=target_type,
        user_id=user_id,
        role=role,
        section_id=section_id,
        created_by=created_by,
    )
    db.add(notification)
    await db.flush()
    return notification


async def _section_ids_for_user(db: AsyncSession, current_user: dict) -> list[str]:
    """Resolve which section(s) a user belongs to, for SECTION-targeted notifications.

    teacher -> sections they're assigned to or are class teacher of
    student -> their active enrollment section
    parent  -> their children's active enrollment sections
    """
    role = current_user["role"]
    uid = current_user["id"]

    if role == "teacher":
        from app.modules.academic.models import Section, TeacherAssignment

        ta = TeacherAssignment.__table__.alias()
        ta_subq = select(ta.c.section_id).where(ta.c.instructor_id == uid)
        sec = Section.__table__.alias()
        ct_subq = select(sec.c.id).where(sec.c.class_teacher_id == uid)
        result = await db.execute(ta_subq.union(ct_subq))
        return [row[0] for row in result.all()]

    if role == "student":
        from app.modules.academic.models import Enrollment
        from app.modules.auth.models import StudentProfile

        sp_subq = select(StudentProfile.id).where(StudentProfile.user_id == uid).scalar_subquery()
        result = await db.execute(
            select(Enrollment.section_id).where(
                Enrollment.student_id == sp_subq, Enrollment.status == "ACTIVE"
            )
        )
        return [row[0] for row in result.all()]

    if role == "parent":
        from app.modules.academic.models import Enrollment
        from app.modules.parent.models import ParentStudentLink

        psl = ParentStudentLink.__table__.alias()
        child_ids_subq = select(psl.c.student_id).where(psl.c.parent_id == uid).subquery()
        result = await db.execute(
            select(Enrollment.section_id).where(
                Enrollment.student_id.in_(select(child_ids_subq)),
                Enrollment.status == "ACTIVE",
            )
        )
        return [row[0] for row in result.all()]

    return []


async def get_notifications_for_user(
    current_user: dict,
    db: AsyncSession,
    unread_only: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    uid = current_user["id"]
    role = current_user["role"]
    section_ids = await _section_ids_for_user(db, current_user)

    target_clause = or_(
        and_(Notification.target_type == TARGET_USER, Notification.user_id == uid),
        and_(Notification.target_type == TARGET_ROLE, Notification.role == role),
        *(
            [and_(Notification.target_type == TARGET_SECTION, Notification.section_id.in_(section_ids))]
            if section_ids
            else []
        ),
    )

    read_subq = select(NotificationRead.notification_id).where(NotificationRead.user_id == uid).subquery()

    q = (
        select(Notification, Notification.id.in_(select(read_subq)).label("is_read"))
        .where(target_clause)
        .order_by(Notification.created_at.desc())
    )
    if unread_only:
        q = q.where(~Notification.id.in_(select(read_subq)))

    q = q.limit(limit).offset(offset)

    result = await db.execute(q)
    rows = result.all()
    return [{**_to_dict(n), "is_read": bool(is_read)} for n, is_read in rows]


async def get_unread_count(current_user: dict, db: AsyncSession) -> int:
    uid = current_user["id"]
    role = current_user["role"]
    section_ids = await _section_ids_for_user(db, current_user)

    target_clause = or_(
        and_(Notification.target_type == TARGET_USER, Notification.user_id == uid),
        and_(Notification.target_type == TARGET_ROLE, Notification.role == role),
        *(
            [and_(Notification.target_type == TARGET_SECTION, Notification.section_id.in_(section_ids))]
            if section_ids
            else []
        ),
    )
    read_subq = select(NotificationRead.notification_id).where(NotificationRead.user_id == uid).subquery()

    result = await db.execute(
        select(func.count()).select_from(Notification).where(
            target_clause, ~Notification.id.in_(select(read_subq))
        )
    )
    return result.scalar_one()


async def mark_as_read(notification_id: str, user_id: str, db: AsyncSession) -> None:
    notification = await db.get(Notification, notification_id)
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    existing = await db.execute(
        select(NotificationRead).where(
            NotificationRead.notification_id == notification_id,
            NotificationRead.user_id == user_id,
        )
    )
    if existing.first():
        return
    db.add(NotificationRead(notification_id=notification_id, user_id=user_id))
    await db.flush()


async def mark_all_as_read(current_user: dict, db: AsyncSession) -> int:
    notifications = await get_notifications_for_user(current_user, db, unread_only=True, limit=1000)
    uid = current_user["id"]
    for n in notifications:
        existing = await db.execute(
            select(NotificationRead).where(
                NotificationRead.notification_id == n["id"],
                NotificationRead.user_id == uid,
            )
        )
        if not existing.first():
            db.add(NotificationRead(notification_id=n["id"], user_id=uid))
    await db.flush()
    return len(notifications)


def _to_dict(n: Notification) -> dict:
    return {
        "id": n.id,
        "title": n.title,
        "message": n.message,
        "type": n.type,
        "link": n.link,
        "target_type": n.target_type,
        "user_id": n.user_id,
        "role": n.role,
        "section_id": n.section_id,
        "created_by": n.created_by,
        "created_at": n.created_at,
    }