from datetime import date
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.modules.academic.models import Class
from app.modules.attendance.models import Attendance, LeaveApplication
from app.modules.auth.models import StudentProfile, User
from app.modules.exams.models import Exam, ExamAggregate, ExamResult
from app.modules.fees.models import Invoice
from app.modules.fees.utils import calculate_late_fee
from app.modules.parent.models import (
    Circular,
    ParentStudentLink,
    TeacherMessage,
    UserNotificationPref,
)


async def get_children(parent_id: str, db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(ParentStudentLink)
        .where(ParentStudentLink.parent_id == parent_id)
    )
    links = result.scalars().all()

    children = []
    for link in links:
        student = await db.get(StudentProfile, link.student_id)
        if not student:
            continue
        cls_name = None
        if student.class_id:
            cls = await db.get(Class, student.class_id)
            if cls:
                cls_name = cls.name
        children.append({
            "student_id": student.id,
            "first_name": student.first_name,
            "last_name": student.last_name,
            "class_name": cls_name,
            "admission_number": student.admission_number,
            "relationship": link.relationship,
        })
    return children


async def get_child_attendance(
    student_id: str, start: date, end: date, db: AsyncSession
) -> list[Attendance]:
    result = await db.execute(
        select(Attendance)
        .where(
            Attendance.student_id == student_id,
            Attendance.date >= start,
            Attendance.date <= end,
        )
        .order_by(Attendance.date.desc())
    )
    return result.scalars().all()


async def get_fee_dues(student_id: str, db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(Invoice)
        .where(
            Invoice.student_id == student_id,
            Invoice.status.in_(["PENDING", "OVERDUE"]),
        )
        .order_by(Invoice.due_date)
    )
    invoices = result.scalars().all()
    return [
        {
            "invoice_id": inv.id,
            "installment_name": inv.installment.name if inv.installment else "",
            "gross_amount": inv.gross_amount,
            "discount_amount": inv.discount_amount,
            "net_amount": inv.net_amount,
            "due_date": inv.due_date,
            "status": inv.status,
            "late_fee": calculate_late_fee(inv),
        }
        for inv in invoices
    ]


async def get_results(student_id: str, db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(ExamResult)
        .where(ExamResult.student_id == student_id)
        .options(joinedload(ExamResult.exam), joinedload(ExamResult.subject))
    )
    rows = result.scalars().all()

    aggregates_result = await db.execute(
        select(ExamAggregate)
        .where(ExamAggregate.student_id == student_id)
    )
    agg_map = {str(a.exam_id): a for a in aggregates_result.scalars().all()}

    by_exam: dict = {}
    for r in rows:
        eid = str(r.exam_id)
        if eid not in by_exam:
            by_exam[eid] = {
                "exam_name": r.exam.name,
                "aggregate": agg_map.get(eid),
                "subjects": [],
            }
        by_exam[eid]["subjects"].append({
            "subject_name": r.subject.name,
            "marks": r.marks,
            "max_marks": r.max_marks,
            "is_absent": r.is_absent,
            "status": r.status,
        })

    out = []
    for eid, data in by_exam.items():
        ag = data["aggregate"]
        out.append({
            "exam_name": data["exam_name"],
            "subjects": data["subjects"],
            "aggregate": {
                "total_marks": ag.total_marks if ag else None,
                "max_total": ag.max_total if ag else None,
                "percentage": ag.percentage if ag else None,
                "grade": ag.grade if ag else None,
                "rank": ag.rank if ag else None,
            } if ag else None,
        })
    return out


async def get_circulars(db: AsyncSession) -> list[Circular]:
    result = await db.execute(
        select(Circular)
        .order_by(Circular.published_at.desc().nullslast(), Circular.created_at.desc())
    )
    return result.scalars().all()


async def create_circular(body, user_id: str, db: AsyncSession) -> Circular:
    from datetime import datetime, timezone
    circular = Circular(
        title=body.title,
        body=body.body,
        attachment_url=body.attachment_url,
        target_class_id=body.target_class_id,
        created_by=user_id,
        published_at=datetime.now(timezone.utc) if body.publish_now else None,
    )
    db.add(circular)
    await db.flush()
    await db.refresh(circular)
    return circular


async def update_circular(circular_id: str, body, db: AsyncSession) -> Circular:
    circular = await db.get(Circular, circular_id)
    if not circular:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Circular not found")
    from datetime import datetime, timezone
    if body.title is not None:
        circular.title = body.title
    if body.body is not None:
        circular.body = body.body
    if body.attachment_url is not None:
        circular.attachment_url = body.attachment_url
    if body.target_class_id is not None:
        circular.target_class_id = body.target_class_id
    if body.publish_now is True and circular.published_at is None:
        circular.published_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(circular)
    return circular


async def delete_circular(circular_id: str, db: AsyncSession) -> None:
    circular = await db.get(Circular, circular_id)
    if not circular:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Circular not found")
    await db.delete(circular)
    await db.flush()


async def send_message_to_teacher(
    parent_id: str,
    student_id: str,
    subject: str,
    body: str,
    db: AsyncSession,
) -> TeacherMessage:
    student = await db.get(StudentProfile, student_id)
    if not student:
        raise ValueError("Student not found")

    class_result = await db.execute(
        select(User).where(
            User.role == "teacher",
            User.is_active.is_(True),
        )
    )
    teachers = class_result.scalars().all()
    if not teachers:
        raise ValueError("No teachers available")

    msg = TeacherMessage(
        sender_id=parent_id,
        receiver_id=teachers[0].id,
        student_id=student_id,
        subject=subject,
        body=body,
    )
    db.add(msg)
    await db.flush()
    return msg


async def get_messages_for_parent(
    parent_id: str, student_id: str | None, db: AsyncSession
) -> list[TeacherMessage]:
    q = select(TeacherMessage).where(
        TeacherMessage.receiver_id == parent_id,
    )
    if student_id:
        q = q.where(TeacherMessage.student_id == student_id)
    q = q.order_by(TeacherMessage.created_at.desc())
    result = await db.execute(q)
    return result.scalars().all()


async def apply_student_leave(
    student_id: str,
    leave_type_id: str,
    start_date: date,
    end_date: date,
    reason: str | None,
    db: AsyncSession,
) -> LeaveApplication:
    leave = LeaveApplication(
        student_id=student_id,
        leave_type_id=leave_type_id,
        start_date=start_date,
        end_date=end_date,
        reason=reason,
    )
    db.add(leave)
    await db.flush()
    return leave


async def get_eligibility(
    student_id: str, academic_year_id: str, db: AsyncSession
) -> dict:
    from app.modules.attendance.eligibility import get_eligibility as _get_eligibility
    return await _get_eligibility(student_id, academic_year_id, db)


async def get_or_create_prefs(user_id: str, db: AsyncSession) -> UserNotificationPref:
    result = await db.execute(
        select(UserNotificationPref).where(UserNotificationPref.user_id == user_id)
    )
    prefs = result.scalar_one_or_none()
    if not prefs:
        prefs = UserNotificationPref(user_id=user_id)
        db.add(prefs)
        await db.flush()
    return prefs


async def update_prefs(
    user_id: str, data: dict, db: AsyncSession
) -> UserNotificationPref:
    prefs = await get_or_create_prefs(user_id, db)
    for field, value in data.items():
        if value is not None:
            setattr(prefs, field, value)
    await db.flush()
    return prefs
