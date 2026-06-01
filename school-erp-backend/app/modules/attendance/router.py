from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import QueryScoper, get_current_user, role_required
from app.modules.attendance.eligibility import get_eligibility
from app.modules.attendance.models import Attendance, LeaveApplication, LeaveType
from app.modules.attendance.schemas import (
    AttendanceMark,
    AttendanceOverviewItem,
    AttendanceResponse,
    EligibilityResponse,
    LeaveApply,
    LeaveResponse,
    LeaveTypeCreate,
    LeaveTypeResponse,
    LeaveUpdate,
)
from app.modules.attendance.service import (
    apply_leave,
    approve_leave,
    get_student_attendance,
    mark_attendance,
    update_attendance_status,
)
from app.modules.auth.models import StudentProfile

admin_only = [role_required("super_admin", "principal")]

teacher_admin = [role_required("super_admin", "principal", "teacher")]

all_auth = [Depends(get_current_user)]

router = APIRouter(prefix="/attendance", tags=["attendance"])


@router.post("/mark", response_model=AttendanceResponse, dependencies=teacher_admin)
async def mark(
    body: AttendanceMark,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await mark_attendance(
        student_id=body.student_id,
        attendance_date=body.date,
        status=body.status.upper(),
        marked_by=current_user["id"],
        period_no=body.period_no,
        db=db,
    )


@router.patch("/mark/{attendance_id}", response_model=AttendanceResponse, dependencies=teacher_admin)
async def update_mark(
    attendance_id: str,
    body: AttendanceMark,
    db: AsyncSession = Depends(get_db),
):
    return await update_attendance_status(attendance_id, body.status.upper(), db)


@router.post("/mark-bulk", dependencies=teacher_admin)
async def mark_bulk(
    records: list[AttendanceMark],
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    results = []
    for r in records:
        rec = await mark_attendance(
            student_id=r.student_id,
            attendance_date=r.date,
            status=r.status.upper(),
            marked_by=current_user["id"],
            period_no=r.period_no,
            db=db,
        )
        results.append({"student_id": r.student_id, "status": rec.status})
    return {"marked": len(results)}


@router.get("/student/{student_id}")
async def get_attendance(
    student_id: str,
    start: date = Query(...),
    end: date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    # Scope check
    role = current_user["role"]
    uid = current_user["id"]
    if role == "teacher":
        from app.modules.academic.models import TeacherAssignment, StudentProfile as SP
        sp = await db.execute(select(SP).where(SP.id == student_id))
        student = sp.scalar_one_or_none()
        if student and student.section_id:
            ta = await db.execute(
                select(TeacherAssignment).where(
                    TeacherAssignment.instructor_id == uid,
                    TeacherAssignment.section_id == student.section_id,
                )
            )
            if not ta.first():
                raise HTTPException(status_code=403, detail="Access denied")
    elif role == "student":
        from app.modules.auth.models import StudentProfile as SP2
        sp = await db.execute(
            select(SP2).where(SP2.user_id == uid, SP2.id == student_id)
        )
        if not sp.first():
            raise HTTPException(status_code=403, detail="Access denied")
    elif role == "parent":
        from app.modules.parent.models import ParentStudentLink
        p = await db.execute(
            select(ParentStudentLink).where(
                ParentStudentLink.parent_id == uid,
                ParentStudentLink.student_id == student_id,
            )
        )
        if not p.first():
            raise HTTPException(status_code=403, detail="Access denied")

    records = await get_student_attendance(student_id, start, end, db)
    return records


@router.get("/leave-types", response_model=list[LeaveTypeResponse])
async def list_leave_types(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(LeaveType))
    return result.scalars().all()


@router.post("/leave-types", response_model=LeaveTypeResponse, dependencies=teacher_admin)
async def create_leave_type(body: LeaveTypeCreate, db: AsyncSession = Depends(get_db)):
    lt = LeaveType(**body.model_dump())
    db.add(lt)
    await db.flush()
    return lt


@router.post("/leaves", response_model=LeaveResponse)
async def apply(
    body: LeaveApply,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await apply_leave(
        student_id=current_user["id"],
        leave_type_id=str(body.leave_type_id),
        start_date=body.start_date,
        end_date=body.end_date,
        reason=body.reason,
        db=db,
    )


@router.patch("/leaves/{leave_id}/approve", response_model=LeaveResponse, dependencies=teacher_admin)
async def approve(
    leave_id: str,
    status: str = Query(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if status.upper() not in ("APPROVED", "REJECTED"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status")
    return await approve_leave(leave_id, current_user["id"], status.upper(), db)


@router.get("/leaves/{leave_id}", response_model=LeaveResponse)
async def get_leave(
    leave_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    leave = await db.get(LeaveApplication, leave_id)
    if not leave:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave not found")

    scope = QueryScoper.for_leaves(db, current_user)
    if scope is not None:
        check = await db.execute(
            select(LeaveApplication).where(LeaveApplication.id == leave_id).where(scope)
        )
        if not check.first():
            raise HTTPException(status_code=403, detail="Access denied")

    return leave


@router.get("/leaves", response_model=list[LeaveResponse])
async def list_leaves(
    student_id: str | None = None,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    q = select(LeaveApplication).order_by(LeaveApplication.created_at.desc())

    scope = QueryScoper.for_leaves(db, current_user)
    if scope is not None:
        q = q.where(scope)

    if student_id:
        q = q.where(LeaveApplication.student_id == student_id)
    if status:
        q = q.where(LeaveApplication.status == status.upper())
    result = await db.execute(q)
    return result.scalars().all()


@router.patch("/leaves/{leave_id}", response_model=LeaveResponse, dependencies=admin_only)
async def update_leave(leave_id: str, body: LeaveUpdate, db: AsyncSession = Depends(get_db)):
    leave = await db.get(LeaveApplication, leave_id)
    if not leave:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave not found")
    if body.start_date is not None:
        leave.start_date = body.start_date
    if body.end_date is not None:
        leave.end_date = body.end_date
    if body.reason is not None:
        leave.reason = body.reason
    if body.status is not None:
        leave.status = body.status.upper()
    await db.flush()
    return leave


@router.delete("/leaves/{leave_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=admin_only)
async def delete_leave(leave_id: str, db: AsyncSession = Depends(get_db)):
    leave = await db.get(LeaveApplication, leave_id)
    if not leave:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave not found")
    await db.delete(leave)


@router.get("/leaves/student/{student_id}", response_model=list[LeaveResponse])
async def student_leaves(student_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(LeaveApplication)
        .where(LeaveApplication.student_id == student_id)
        .order_by(LeaveApplication.created_at.desc())
    )
    return result.scalars().all()


@router.get("/by-section")
async def attendance_by_section(
    section_id: str,
    date: date,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    from app.modules.auth.models import StudentProfile as SP
    from app.modules.academic.models import Section, TeacherAssignment
    from sqlalchemy.orm import joinedload

    uid = current_user["id"]
    role = current_user["role"]

    if role not in ("super_admin", "principal", "teacher"):
        raise HTTPException(status_code=403, detail="Access denied")

    section = await db.get(Section, section_id)
    if not section:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")

    if role == "teacher":
        ta = await db.execute(
            select(TeacherAssignment).where(
                TeacherAssignment.instructor_id == uid,
                TeacherAssignment.section_id == section_id,
            )
        )
        if not ta.first():
            raise HTTPException(status_code=403, detail="Access denied")

    records = await db.execute(
        select(Attendance)
        .where(Attendance.date == date)
        .order_by(Attendance.student_id)
    )
    return records.scalars().all()


@router.get("/overview", response_model=list[AttendanceOverviewItem])
async def attendance_overview(
    start: date = Query(...),
    end: date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    from app.modules.academic.models import TeacherAssignment
    from app.modules.parent.models import ParentStudentLink

    role = current_user["role"]
    uid = current_user["id"]

    base_query = select(
        Attendance.id,
        Attendance.student_id,
        Attendance.date,
        Attendance.period_no,
        Attendance.status,
        StudentProfile.class_id.label("student_group"),
    ).join(StudentProfile, Attendance.student_id == StudentProfile.id)

    # Apply role scoping directly for attendance
    if role == "teacher":
        ta_alias = TeacherAssignment.__table__.alias()
        section_ids_q = select(ta_alias.c.section_id).where(ta_alias.c.instructor_id == uid).subquery()
        student_ids_q = select(StudentProfile.id).where(StudentProfile.section_id.in_(section_ids_q)).subquery()
        base_query = base_query.where(Attendance.student_id.in_(student_ids_q))
    elif role == "student":
        sp_q = select(StudentProfile.id).where(StudentProfile.user_id == uid).scalar_subquery()
        base_query = base_query.where(Attendance.student_id == sp_q)
    elif role == "parent":
        psl_alias = ParentStudentLink.__table__.alias()
        child_ids_q = select(psl_alias.c.student_id).where(psl_alias.c.parent_id == uid).subquery()
        base_query = base_query.where(Attendance.student_id.in_(child_ids_q))

    base_query = base_query.where(
        Attendance.date >= start, Attendance.date <= end
    ).order_by(Attendance.date.desc(), Attendance.student_id)

    result = await db.execute(base_query)
    rows = result.all()
    return [
        AttendanceOverviewItem(
            id=r.id,
            student_id=r.student_id,
            date=r.date,
            period_no=r.period_no,
            status=r.status,
            student_group=str(r.student_group) if r.student_group else None,
        )
        for r in rows
    ]


@router.get("/eligibility/{student_id}", response_model=EligibilityResponse)
async def eligibility(
    student_id: str,
    academic_year_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await get_eligibility(student_id, academic_year_id, db)
    return EligibilityResponse(student_id=student_id, **result)
