from datetime import datetime, timezone
from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_ as sa_and_, func as sa_func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import QueryScoper, get_current_user, role_required
from app.core.security import hash_password
from app.modules.academic.models import (
    AcademicProgression,
    AcademicYear,
    Class,
    ClassSubject,
    Enrollment,
    Holiday,
    Section,
    Subject,
    TeacherAssignment,
)
from app.modules.academic.service import PromotionError, promote_students
from app.modules.academic.utils import generate_admission_number
from app.modules.academic.schemas import (
    AcademicYearCreate,
    AcademicYearResponse,
    ClassCreate,
    ClassResponse,
    ClassDetailResponse,
    ClassSubjectCreate,
    ClassSubjectResponse,
    EnrollmentCreate,
    EnrollmentResponse,
    EnrollmentUpdate,
    PaginatedStudentResponse,
    HolidayCreate,
    HolidayResponse,
    InstructorCreate,
    InstructorResponse,
    InstructorUpdate,
    PromotionRequest,
    ProgressionResponse,
    SectionCreate,
    SectionDetailResponse,
    SectionResponse,
    SectionUpdate,
    StudentCreate,
    StudentProfileResponse,
    StudentFinancialResponse,
    StudentSearchResponse,
    StudentUpdate,
    SubjectCreate,
    SubjectResponse,
    SubjectUpdate,
    TeacherAssignmentCreate,
    TeacherAssignmentUpdate,
    TeacherAssignmentResponse,
    TransferCreate,
)
from app.modules.auth.models import StudentProfile, StaffProfile, User
from app.modules.academic.models import Class as AcademicClass

admin_only = role_required("super_admin", "principal")
all_auth = [Depends(get_current_user)]

router = APIRouter(prefix="/academic", tags=["academic"])


# ── Helper: fetch student row without Depends ─────────────────────────────────

async def _fetch_student_row(student_id: str, db: AsyncSession):
    enrollment_alias = Enrollment.__table__.alias()
    academic_class_alias = AcademicClass.__table__.alias()
    section_alias = Section.__table__.alias()

    result = await db.execute(
        select(
            StudentProfile.id,
            StudentProfile.user_id,
            StudentProfile.first_name,
            StudentProfile.last_name,
            StudentProfile.date_of_birth,
            StudentProfile.admission_number,
            StudentProfile.guardian_name,
            StudentProfile.guardian_phone,
            StudentProfile.address,
            StudentProfile.created_at,
            academic_class_alias.c.name.label("student_group_name"),
            section_alias.c.name.label("section_name"),
            enrollment_alias.c.class_id,
            enrollment_alias.c.section_id,
            enrollment_alias.c.roll_number,
            User.email,
            User.is_active,
        ).join(User, StudentProfile.user_id == User.id)
        .outerjoin(enrollment_alias, sa_and_(
            enrollment_alias.c.student_id == StudentProfile.id,
            enrollment_alias.c.status == "ACTIVE",
        ))
        .outerjoin(academic_class_alias, enrollment_alias.c.class_id == academic_class_alias.c.id)
        .outerjoin(section_alias, enrollment_alias.c.section_id == section_alias.c.id)
        .where(StudentProfile.id == student_id)
    )
    return result.one_or_none()


def _row_to_student_response(row) -> StudentProfileResponse:
    return StudentProfileResponse(
        id=row.id,
        user_id=row.user_id,
        first_name=row.first_name,
        last_name=row.last_name,
        date_of_birth=row.date_of_birth,
        admission_number=row.admission_number,
        student_group_name=row.student_group_name,
        section_name=row.section_name,
        guardian_name=row.guardian_name,
        guardian_phone=row.guardian_phone,
        address=row.address,
        email=row.email,
        student_email_id=row.email,
        student_email=row.email,
        is_active=row.is_active,
        enabled=(1 if row.is_active else 0) if row.is_active is not None else None,
        student_name=f"{row.first_name} {row.last_name}".strip(),
        creation=row.created_at,
    )


@router.get("/years", response_model=list[AcademicYearResponse])
async def list_years(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AcademicYear).order_by(AcademicYear.start_date.desc()))
    years = result.scalars().all()
    today = date.today()
    return [
        AcademicYearResponse(
            id=y.id, name=y.name, start_date=y.start_date, end_date=y.end_date,
            is_active=y.is_active,
            is_current=(y.start_date <= today <= y.end_date),
        )
        for y in years
    ]


@router.post("/years", response_model=AcademicYearResponse, dependencies=[admin_only])
async def create_year(body: AcademicYearCreate, db: AsyncSession = Depends(get_db)):
    if body.is_active:
        active = (await db.execute(select(AcademicYear).where(AcademicYear.is_active.is_(True)))).scalar_one_or_none()
        if active:
            active.is_active = False
    year = AcademicYear(**body.model_dump())
    db.add(year)
    await db.flush()
    return year


@router.patch("/years/{year_id}/activate", dependencies=[admin_only])
async def activate_year(year_id: str, db: AsyncSession = Depends(get_db)):
    active = (await db.execute(select(AcademicYear).where(AcademicYear.is_active.is_(True)))).scalar_one_or_none()
    if active and str(active.id) != year_id:
        active.is_active = False
    year = await db.get(AcademicYear, year_id)
    if not year:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    year.is_active = True
    await db.flush()
    return {"ok": True}


@router.get("/classes", response_model=list[ClassResponse])
async def list_classes(db: AsyncSession = Depends(get_db)):
    subj_count = (
        select(
            ClassSubject.class_id,
            sa_func.count(ClassSubject.id).label("subject_count"),
        )
        .group_by(ClassSubject.class_id)
        .subquery()
    )
    result = await db.execute(
        select(
            Class.id,
            Class.name,
            Class.order,
            sa_func.coalesce(subj_count.c.subject_count, 0).label("subject_count"),
        )
        .outerjoin(subj_count, Class.id == subj_count.c.class_id)
        .order_by(Class.order)
    )
    rows = result.all()
    return [
        ClassResponse(id=r.id, name=r.name, order=r.order, subject_count=r.subject_count)
        for r in rows
    ]


@router.post("/classes", response_model=ClassResponse, dependencies=[admin_only])
async def create_class(body: ClassCreate, db: AsyncSession = Depends(get_db)):
    cls = Class(**body.model_dump())
    db.add(cls)
    await db.flush()
    return cls


@router.get("/sections", response_model=list[SectionResponse])
async def list_sections(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Section).options(joinedload(Section.class_), joinedload(Section.academic_year))
    )
    sections = result.unique().scalars().all()
    return [
        SectionResponse(
            id=s.id, class_id=s.class_id, name=s.name, capacity=s.capacity,
            academic_year_id=s.academic_year_id,
            program=s.class_.name if s.class_ else "",
            academic_year=s.academic_year.name if s.academic_year else "",
            class_teacher_id=s.class_teacher_id,
        )
        for s in sections
    ]


@router.post("/sections", response_model=SectionResponse, dependencies=[admin_only])
async def create_section(body: SectionCreate, db: AsyncSession = Depends(get_db)):
    section = Section(**body.model_dump())
    db.add(section)
    await db.flush()
    await db.refresh(section, ["class_", "academic_year"])
    return SectionResponse(
        id=section.id,
        class_id=section.class_id,
        name=section.name,
        capacity=section.capacity,
        academic_year_id=section.academic_year_id,
        program=section.class_.name if section.class_ else "",
        academic_year=section.academic_year.name if section.academic_year else "",
        class_teacher_id=section.class_teacher_id
    )


@router.get("/subjects", response_model=list[SubjectResponse])
async def list_subjects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Subject).order_by(Subject.name))
    return result.scalars().all()


@router.post("/subjects", response_model=SubjectResponse, dependencies=[admin_only])
async def create_subject(body: SubjectCreate, db: AsyncSession = Depends(get_db)):
    data = body.model_dump()
    if not data.get("code"):        # ← if code is empty or None
        data["code"] = None         # ← save as NULL not ""
    subject = Subject(**data)
    db.add(subject)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A subject with this official code already exists."
        )
    return subject


@router.get("/years/{year_id}", response_model=AcademicYearResponse)
async def get_year(year_id: str, db: AsyncSession = Depends(get_db)):
    year = await db.get(AcademicYear, year_id)
    if not year:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Academic year not found")
    today = date.today()
    return AcademicYearResponse(
        id=year.id, name=year.name, start_date=year.start_date, end_date=year.end_date,
        is_active=year.is_active,
        is_current=(year.start_date <= today <= year.end_date),
    )


@router.get("/classes/{class_id}", response_model=ClassResponse)
async def get_class(class_id: str, db: AsyncSession = Depends(get_db)):
    cls = await db.get(Class, class_id)
    if not cls:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
    return cls


@router.get("/subjects/{subject_id}", response_model=SubjectResponse)
async def get_subject(subject_id: str, db: AsyncSession = Depends(get_db)):
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
    return subject


@router.get("/classes/{class_id}/subjects", response_model=list[ClassSubjectResponse])
async def get_class_subjects(class_id: str, db: AsyncSession = Depends(get_db)):
    cls = await db.get(Class, class_id)
    if not cls:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
    result = await db.execute(
        select(ClassSubject, Subject)
        .join(Subject, ClassSubject.subject_id == Subject.id)
        .where(ClassSubject.class_id == class_id)
        .order_by(Subject.name)
    )
    rows = result.all()
    return [
        ClassSubjectResponse(
            id=cs.id, class_id=cs.class_id, subject_id=cs.subject_id,
            subject_name=subj.name, subject_code=subj.code or None,
        )
        for cs, subj in rows
    ]


@router.post("/classes/{class_id}/subjects", response_model=ClassSubjectResponse, dependencies=[admin_only])
async def link_subject(class_id: str, body: ClassSubjectCreate, db: AsyncSession = Depends(get_db)):
    cls = await db.get(Class, class_id)
    if not cls:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
    subject = await db.get(Subject, body.subject_id)
    if not subject:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
    existing = await db.execute(
        select(ClassSubject).where(
            ClassSubject.class_id == class_id,
            ClassSubject.subject_id == body.subject_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Subject already linked to this class")
    link = ClassSubject(class_id=class_id, subject_id=body.subject_id)
    db.add(link)
    await db.flush()
    return ClassSubjectResponse(
        id=link.id, class_id=link.class_id, subject_id=link.subject_id,
        subject_name=subject.name, subject_code=subject.code,
    )


@router.delete("/classes/{class_id}/subjects/{subject_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[admin_only])
async def unlink_subject(class_id: str, subject_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ClassSubject).where(
            ClassSubject.class_id == class_id,
            ClassSubject.subject_id == subject_id,
        )
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not linked to this class")
    await db.delete(link)
    await db.flush()


@router.get("/classes/{class_id}/detail", response_model=ClassDetailResponse)
async def get_class_detail(class_id: str, db: AsyncSession = Depends(get_db)):
    cls = await db.get(Class, class_id)
    if not cls:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")

    subj_result = await db.execute(
        select(ClassSubject, Subject)
        .join(Subject, ClassSubject.subject_id == Subject.id)
        .where(ClassSubject.class_id == class_id)
        .order_by(Subject.name)
    )
    subjects = [
        ClassSubjectResponse(
            id=cs.id, class_id=cs.class_id, subject_id=cs.subject_id,
            subject_name=subj.name, subject_code=subj.code or None,
        )
        for cs, subj in subj_result.all()
    ]

    sec_result = await db.execute(
        select(Section).options(joinedload(Section.academic_year))
        .where(Section.class_id == class_id)
        .order_by(Section.name)
    )
    sections_raw = sec_result.unique().scalars().all()
    sections = [
        SectionResponse(
            id=s.id, class_id=s.class_id, name=s.name, capacity=s.capacity,
            academic_year_id=s.academic_year_id,
            program=cls.name,
            academic_year=s.academic_year.name if s.academic_year else "",
        )
        for s in sections_raw
    ]

    return ClassDetailResponse(
        id=cls.id, name=cls.name, order=cls.order,
        subjects=subjects, sections=sections,
    )


@router.get("/holidays", response_model=list[HolidayResponse])
async def list_holidays(year: int | None = None, db: AsyncSession = Depends(get_db)):
    q = select(Holiday).order_by(Holiday.date)
    if year:
        q = q.where(
            Holiday.date >= f"{year}-01-01",
            Holiday.date <= f"{year}-12-31",
        )
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/holidays", response_model=HolidayResponse, dependencies=[admin_only])
async def create_holiday(body: HolidayCreate, db: AsyncSession = Depends(get_db)):
    holiday = Holiday(**body.model_dump())
    db.add(holiday)
    await db.flush()
    return holiday


@router.post("/progression/promote", dependencies=[admin_only])
async def promote(
    body: PromotionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    try:
        progressions = await promote_students(
            db=db,
            student_ids=body.student_ids,
            from_academic_year_id=body.from_academic_year_id,
            to_academic_year_id=body.to_academic_year_id,
            to_class_id=body.to_class_id,
            to_section_id=body.to_section_id,
            promoted_by_user_id=current_user["id"],
        )
    except PromotionError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return [
        ProgressionResponse(
            id=p.id,
            student_id=p.student_id,
            from_class_id=p.from_class_id,
            to_class_id=p.to_class_id,
            from_academic_year_id=p.from_academic_year_id,
            to_academic_year_id=p.to_academic_year_id,
            is_retained=p.is_retained,
            promoted_by=p.promoted_by,
            promoted_at=p.promoted_at,
        )
        for p in progressions
    ]


@router.get("/progression", response_model=list[ProgressionResponse], dependencies=[admin_only])
async def list_progressions(
    academic_year_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(AcademicProgression).order_by(AcademicProgression.promoted_at.desc())
    if academic_year_id:
        q = q.where(AcademicProgression.to_academic_year_id == academic_year_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/students", response_model=PaginatedStudentResponse)
async def list_students(
    section_id: Optional[str] = None,
    academic_year_id: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    per_page: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    enrollment_alias = Enrollment.__table__.alias()
    academic_class_alias = AcademicClass.__table__.alias()
    section_alias = Section.__table__.alias()

    # Match the enrollment for the SELECTED year (so each year shows that year's
    # placement). If no year is given, fall back to the current ACTIVE enrollment.
    enr_conditions = [enrollment_alias.c.student_id == StudentProfile.id]
    _year_ok = False
    if academic_year_id:
        try:
            UUID(academic_year_id)
            _year_ok = True
        except ValueError:
            _year_ok = False
    if _year_ok:
        enr_conditions.append(enrollment_alias.c.academic_year_id == academic_year_id)
    else:
        enr_conditions.append(enrollment_alias.c.status == "ACTIVE")

    query = select(
        StudentProfile.id,
        StudentProfile.user_id,
        StudentProfile.first_name,
        StudentProfile.last_name,
        StudentProfile.date_of_birth,
        StudentProfile.admission_number,
        StudentProfile.guardian_name,
        StudentProfile.guardian_phone,
        StudentProfile.address,
        StudentProfile.created_at,
        academic_class_alias.c.name.label("student_group_name"),
        section_alias.c.name.label("section_name"),
        enrollment_alias.c.class_id,
        enrollment_alias.c.section_id,
        enrollment_alias.c.roll_number,
        User.email,
        User.is_active,
    ).join(User, StudentProfile.user_id == User.id
    ).outerjoin(enrollment_alias, sa_and_(*enr_conditions)
    ).outerjoin(academic_class_alias, enrollment_alias.c.class_id == academic_class_alias.c.id
    ).outerjoin(section_alias, enrollment_alias.c.section_id == section_alias.c.id
    ).where(User.deleted_at.is_(None), User.is_active.is_(True))

    if section_id:
        try:
            UUID(section_id)
        except ValueError:
            pass
        else:
            query = query.where(enrollment_alias.c.section_id == section_id)

    if search:
        like = f"%{search}%"
        query = query.where(
            StudentProfile.first_name.ilike(like)
            | StudentProfile.last_name.ilike(like)
            | StudentProfile.admission_number.ilike(like)
            | User.email.ilike(like)
        )

    query = query.order_by(StudentProfile.first_name)

    scope = QueryScoper.for_students(db, current_user)
    if scope is not None:
        query = query.where(scope)

    count_query = select(sa_func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page)

    result = await db.execute(query)
    rows = result.all()
    total_pages = max(1, (total + per_page - 1) // per_page)
    return PaginatedStudentResponse(
        data=[
            StudentProfileResponse(
                id=r.id, user_id=r.user_id, first_name=r.first_name, last_name=r.last_name,
                name=str(r.id), date_of_birth=r.date_of_birth, admission_number=r.admission_number,
                student_group_name=r.student_group_name,
                section_name=r.section_name,
                guardian_name=r.guardian_name, guardian_phone=r.guardian_phone,
                address=r.address, email=r.email, student_email_id=r.email, student_email=r.email,
                is_active=r.is_active, enabled=(1 if r.is_active else 0) if r.is_active is not None else None,
                student_name=f"{r.first_name} {r.last_name}".strip(),
                creation=r.created_at,
            )
            for r in rows
        ],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


@router.get("/instructors", response_model=list[InstructorResponse])
async def list_instructors(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            User.id.label("user_id"),
            User.email,
            User.is_active,
            StaffProfile.id.label("id"),
            StaffProfile.first_name,
            StaffProfile.last_name,
            StaffProfile.employee_id,
            StaffProfile.department,
            StaffProfile.qualification,
        ).outerjoin(StaffProfile, StaffProfile.user_id == User.id)
        .where(User.role == "teacher", User.is_active.is_(True))
    )
    rows = result.all()
    return [
        InstructorResponse(
            id=r.id or r.user_id,
            user_id=r.user_id,
            email=r.email,
            first_name=r.first_name or r.email or "",
            last_name=r.last_name or "",
            employee_id=r.employee_id or str(r.user_id),
            department=r.department,
            qualification=r.qualification,
            is_active=r.is_active,
        )
        for r in rows
    ]


# ── Student Single CRUD ───────────────────────────────────────────────────

@router.get("/students/search", response_model=list[StudentSearchResponse])
async def search_students(
    q: str = "",
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    role = current_user["role"]
    if role not in ("super_admin", "principal", "teacher", "librarian", "accountant", "parent"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    enrollment_alias = Enrollment.__table__.alias()
    academic_class_alias = AcademicClass.__table__.alias()
    section_alias = Section.__table__.alias()

    query = (
        select(
            StudentProfile.id,
            StudentProfile.first_name,
            StudentProfile.last_name,
            StudentProfile.admission_number,
            enrollment_alias.c.class_id,
            enrollment_alias.c.section_id,
            academic_class_alias.c.name.label("student_group_name"),
            section_alias.c.name.label("section_name"),
            User.email,
        ).join(User, StudentProfile.user_id == User.id
        ).outerjoin(enrollment_alias, sa_and_(
            enrollment_alias.c.student_id == StudentProfile.id,
            enrollment_alias.c.status == "ACTIVE",
        )).outerjoin(
            academic_class_alias,
            enrollment_alias.c.class_id == academic_class_alias.c.id,
        ).outerjoin(
            section_alias,
            enrollment_alias.c.section_id == section_alias.c.id,
        )
    )

    if q:
        query = query.where(
            StudentProfile.first_name.ilike(f"%{q}%")
            | StudentProfile.last_name.ilike(f"%{q}%")
            | StudentProfile.admission_number.ilike(f"%{q}%")
            | User.email.ilike(f"%{q}%")
        )

    scope = QueryScoper.for_students(db, current_user)
    if scope is not None:
        query = query.where(scope)

    query = query.limit(20)
    result = await db.execute(query)
    rows = result.all()
    return [
        StudentSearchResponse(
            id=r.id,
            first_name=r.first_name,
            last_name=r.last_name,
            admission_number=r.admission_number,
            class_id=r.class_id,
            student_group_name=r.student_group_name,
            section_name=r.section_name,
            email=r.email,
        )
        for r in rows
    ]


@router.get("/students/{student_id}", response_model=StudentProfileResponse)
async def get_student(
    student_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    row = await _fetch_student_row(student_id, db)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    role = current_user["role"]
    uid = current_user["id"]
    if role == "teacher":
        ta = await db.execute(
            select(TeacherAssignment).where(
                TeacherAssignment.instructor_id == uid,
                TeacherAssignment.section_id == row.section_id,
            )
        )
        if not ta.first():
            raise HTTPException(status_code=403, detail="Access denied")
    elif role == "student":
        sp = await db.execute(
            select(StudentProfile).where(
                StudentProfile.user_id == uid,
                StudentProfile.id == student_id,
            )
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

    return _row_to_student_response(row)


@router.post("/students", response_model=StudentProfileResponse, dependencies=[admin_only])
async def create_student(body: StudentCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email, User.deleted_at.is_(None)))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(
        email=body.email,
        hashed_pw=hash_password(body.password),
        role="student",
        is_active=True,
    )
    db.add(user)
    await db.flush()
    profile = StudentProfile(
        user_id=user.id,
        first_name=body.first_name,
        last_name=body.last_name,
        date_of_birth=body.date_of_birth,
        admission_number=generate_admission_number(body.aadhar_number, body.first_name, body.last_name),
        aadhar_number=body.aadhar_number,
        guardian_name=body.guardian_name,
        guardian_phone=body.guardian_phone,
        address=body.address,
        is_new_student=body.is_new_student,
    )
    db.add(profile)
    await db.flush()

    if body.class_id and body.academic_year_id:
        cls = await db.get(Class, body.class_id)
        if not cls:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
        year = await db.get(AcademicYear, body.academic_year_id)
        if not year:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Academic year not found")
        enrollment = Enrollment(
            student_id=profile.id,
            class_id=body.class_id,
            section_id=body.section_id or None,
            academic_year_id=body.academic_year_id,
            status="ACTIVE",
        )
        db.add(enrollment)
        await db.flush()
        # No invoice generation needed: fees owed are computed on the fly
        # from FeeStructure (see app.modules.fees.service.get_student_owed_amount)
        # rather than pre-generated as rows, so there's nothing to create here.

    row = await _fetch_student_row(str(profile.id), db)
    if not row:
        raise HTTPException(status_code=500, detail="Failed to fetch created student")
    return _row_to_student_response(row)


@router.patch("/students/{student_id}", response_model=StudentProfileResponse, dependencies=[admin_only])
async def update_student(student_id: str, body: StudentUpdate, db: AsyncSession = Depends(get_db)):
    profile = await db.get(StudentProfile, student_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    if body.first_name is not None:
        profile.first_name = body.first_name
    if body.last_name is not None:
        profile.last_name = body.last_name
    if body.date_of_birth is not None:
        profile.date_of_birth = body.date_of_birth
    if body.guardian_name is not None:
        profile.guardian_name = body.guardian_name
    if body.guardian_phone is not None:
        profile.guardian_phone = body.guardian_phone
    if body.address is not None:
        profile.address = body.address
    if body.aadhar_number is not None:
        profile.aadhar_number = body.aadhar_number
        # Regenerate the admission number now that Aadhar is known/changed,
        # so editing in a missing Aadhar (for students created before this
        # field existed) automatically gives them the correct formatted ID.
        profile.admission_number = generate_admission_number(
            body.aadhar_number, profile.first_name, profile.last_name
        )
    user = await db.get(User, profile.user_id)
    if user and body.is_active is not None:
        user.is_active = body.is_active
    await db.flush()
    row = await _fetch_student_row(student_id, db)
    if not row:
        raise HTTPException(status_code=500, detail="Failed to fetch updated student")
    return _row_to_student_response(row)


@router.delete("/students/{student_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(get_current_user)])
async def delete_student(
    student_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    role = current_user["role"]
    if role not in ("super_admin", "principal"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    profile = await db.get(StudentProfile, student_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    user = await db.get(User, profile.user_id)
    if role == "super_admin" and user:
        user.deleted_at = datetime.now(timezone.utc)
        user.is_active = False
    elif role == "principal" and user:
        user.is_active = False
    await db.flush()


@router.get("/students/{student_id}/financial", response_model=StudentFinancialResponse)
async def get_student_financial(
    student_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    role = current_user["role"]
    if role not in ("super_admin", "principal", "accountant"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    enrollment_alias = Enrollment.__table__.alias()
    academic_class_alias = AcademicClass.__table__.alias()
    result = await db.execute(
        select(
            StudentProfile.id, StudentProfile.first_name, StudentProfile.last_name,
            StudentProfile.admission_number,
            academic_class_alias.c.name.label("student_group_name"),
        ).outerjoin(enrollment_alias, sa_and_(
            enrollment_alias.c.student_id == StudentProfile.id,
            enrollment_alias.c.status == "ACTIVE",
        ))
        .outerjoin(academic_class_alias, enrollment_alias.c.class_id == academic_class_alias.c.id)
        .where(StudentProfile.id == student_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    # Fees are now computed from FeeStructure/FeeReceipt rather than a
    # separate Invoice table (which no longer exists), so reuse the same
    # summary helper the Fees module itself uses for these numbers.
    from app.modules.fees.service import get_current_academic_year, get_student_fee_summary

    year = await get_current_academic_year(db)
    total_fees = 0.0
    paid_amount = 0.0
    if year:
        summary = await get_student_fee_summary(str(student_id), str(year.id), db)
        total_fees = float(summary["owed"])
        paid_amount = float(summary["paid"])

    due_amount = max(0.0, total_fees - paid_amount)
    payment_status = (
        "paid" if total_fees > 0 and due_amount == 0
        else "partial" if paid_amount > 0
        else "unpaid" if total_fees > 0
        else "no_fees"
    )

    return StudentFinancialResponse(
        id=row.id, first_name=row.first_name, last_name=row.last_name,
        admission_number=row.admission_number,
        student_group_name=row.student_group_name,
        total_fees=total_fees, paid_amount=paid_amount, due_amount=due_amount,
        last_payment_date=None,
        payment_status=payment_status,
    )


# ── Instructor Single CRUD ────────────────────────────────────────────────


@router.get("/instructors/{instructor_id}", response_model=InstructorResponse)
async def get_instructor(instructor_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            User.id.label("user_id"),
            User.email,
            User.is_active,
            StaffProfile.id.label("profile_id"),
            StaffProfile.first_name,
            StaffProfile.last_name,
            StaffProfile.employee_id,
            StaffProfile.department,
            StaffProfile.qualification,
        ).outerjoin(StaffProfile, StaffProfile.user_id == User.id)
        .where(User.role == "teacher", User.id == instructor_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instructor not found")
    return InstructorResponse(
        id=row.profile_id or row.user_id,
        user_id=row.user_id,
        email=row.email,
        first_name=row.first_name or row.email or "",
        last_name=row.last_name or "",
        employee_id=row.employee_id or str(row.user_id),
        department=row.department,
        qualification=row.qualification,
        is_active=row.is_active,
    )


@router.post("/instructors", response_model=InstructorResponse, dependencies=[admin_only])
async def create_instructor(body: InstructorCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email, User.deleted_at.is_(None)))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(
        email=body.email,
        hashed_pw=hash_password(body.password),
        role="teacher",
        is_active=True,
    )
    db.add(user)
    await db.flush()
    profile = StaffProfile(
        user_id=user.id,
        first_name=body.first_name,
        last_name=body.last_name,
        employee_id=body.employee_id or f"EMP-{user.id}",
        department=body.department,
        qualification=body.qualification,
    )
    db.add(profile)
    await db.flush()
    return await get_instructor(str(user.id), db)


@router.patch("/instructors/{instructor_id}", response_model=InstructorResponse, dependencies=[admin_only])
async def update_instructor(instructor_id: str, body: InstructorUpdate, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, instructor_id)
    if not user or user.role != "teacher":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instructor not found")
    if body.is_active is not None:
        user.is_active = body.is_active
    profile = await db.execute(select(StaffProfile).where(StaffProfile.user_id == instructor_id))
    profile = profile.scalar_one_or_none()
    if profile:
        if body.first_name is not None:
            profile.first_name = body.first_name
        if body.last_name is not None:
            profile.last_name = body.last_name
        if body.employee_id is not None:
            profile.employee_id = body.employee_id
        if body.department is not None:
            profile.department = body.department
        if body.qualification is not None:
            profile.qualification = body.qualification
    await db.flush()
    return await get_instructor(instructor_id, db)


@router.delete("/instructors/{instructor_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[admin_only])
async def delete_instructor(instructor_id: str, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, instructor_id)
    if not user or user.role != "teacher":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instructor not found")
    user.deleted_at = datetime.now(timezone.utc)
    user.is_active = False
    await db.flush()


# ── Section Detail (with students) ────────────────────────────────────────


@router.get("/sections/{section_id}", response_model=SectionDetailResponse)
async def get_section(
    section_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    section = await db.get(Section, section_id)
    if not section:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")

    role = current_user["role"]
    uid = current_user["id"]
    if role == "teacher":
        ta = await db.execute(
            select(TeacherAssignment).where(
                TeacherAssignment.instructor_id == uid,
                TeacherAssignment.section_id == section_id,
            )
        )
        if not ta.first():
            raise HTTPException(status_code=403, detail="Access denied to this section")
    elif role == "student":
        enrollment_alias = Enrollment.__table__.alias()
        sp = await db.execute(
            select(StudentProfile).join(
                enrollment_alias, sa_and_(
                    enrollment_alias.c.student_id == StudentProfile.id,
                    enrollment_alias.c.status == "ACTIVE",
                )
            ).where(
                StudentProfile.user_id == uid,
                enrollment_alias.c.section_id == section_id,
            )
        )
        if not sp.first():
            raise HTTPException(status_code=403, detail="Access denied")
    elif role == "parent":
        from app.modules.parent.models import ParentStudentLink
        enrollment_alias = Enrollment.__table__.alias()
        p = await db.execute(
            select(ParentStudentLink).join(
                enrollment_alias,
                ParentStudentLink.student_id == enrollment_alias.c.student_id,
            ).where(
                ParentStudentLink.parent_id == uid,
                enrollment_alias.c.section_id == section_id,
                enrollment_alias.c.status == "ACTIVE",
            )
        )
        if not p.first():
            raise HTTPException(status_code=403, detail="Access denied")

    enrollment_alias = Enrollment.__table__.alias()
    academic_class_alias = AcademicClass.__table__.alias()
    section_alias = Section.__table__.alias()

    students_result = await db.execute(
        select(
            StudentProfile.id,
            StudentProfile.user_id,
            StudentProfile.first_name,
            StudentProfile.last_name,
            StudentProfile.date_of_birth,
            StudentProfile.admission_number,
            StudentProfile.guardian_name,
            StudentProfile.guardian_phone,
            StudentProfile.address,
            StudentProfile.created_at,
            academic_class_alias.c.name.label("student_group_name"),
            section_alias.c.name.label("section_name"),
            enrollment_alias.c.class_id,
            enrollment_alias.c.section_id,
            enrollment_alias.c.roll_number,
            User.email,
            User.is_active,
        ).join(User, StudentProfile.user_id == User.id)
        .join(enrollment_alias, sa_and_(
            enrollment_alias.c.student_id == StudentProfile.id,
            enrollment_alias.c.section_id == section_id,
            enrollment_alias.c.status == "ACTIVE",
        ))
        .outerjoin(academic_class_alias, enrollment_alias.c.class_id == academic_class_alias.c.id)
        .outerjoin(section_alias, enrollment_alias.c.section_id == section_alias.c.id)
    )
    students = [
        StudentProfileResponse(
            id=r.id, user_id=r.user_id, first_name=r.first_name, last_name=r.last_name,
            date_of_birth=r.date_of_birth, admission_number=r.admission_number,
            student_group_name=r.student_group_name,
            section_name=r.section_name,
            guardian_name=r.guardian_name, guardian_phone=r.guardian_phone,
            address=r.address, email=r.email, is_active=r.is_active, creation=r.created_at,
        )
        for r in students_result.all()
    ]
    return SectionDetailResponse(
        id=section.id,
        class_id=section.class_id,
        name=section.name,
        capacity=section.capacity,
        academic_year_id=section.academic_year_id,
        program=section.class_.name if section.class_ else "",
        academic_year=section.academic_year.name if section.academic_year else "",
        class_teacher_id=section.class_teacher_id,
        students=students,
    )


@router.patch("/sections/{section_id}", response_model=SectionResponse, dependencies=[admin_only])
async def update_section(
    section_id: str,
    body: SectionUpdate,
    db: AsyncSession = Depends(get_db),
):
    section = await db.get(Section, section_id)
    if not section:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    if body.name is not None:
        section.name = body.name
    if body.capacity is not None:
        section.capacity = body.capacity
    if body.class_id is not None:
        section.class_id = body.class_id
    if body.class_teacher_id is not None:
        if str(body.class_teacher_id) == "00000000-0000-0000-0000-000000000000" or body.class_teacher_id == "":
            section.class_teacher_id = None
        else:
            section.class_teacher_id = body.class_teacher_id
    await db.flush()
    await db.refresh(section, ["class_", "academic_year"])
    return SectionResponse(
        id=section.id,
        class_id=section.class_id,
        name=section.name,
        capacity=section.capacity,
        academic_year_id=section.academic_year_id,
        program=section.class_.name if section.class_ else "",
        academic_year=section.academic_year.name if section.academic_year else "",
        class_teacher_id=section.class_teacher_id
    )


@router.patch("/classes/{class_id}", response_model=ClassResponse, dependencies=[admin_only])
async def update_class(class_id: str, name: str | None = None, order: int | None = None, db: AsyncSession = Depends(get_db)):
    cls = await db.get(Class, class_id)
    if not cls:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
    if name is not None:
        cls.name = name
    if order is not None:
        cls.order = order
    await db.flush()
    return cls


@router.patch("/subjects/{subject_id}", response_model=SubjectResponse, dependencies=[admin_only])
async def update_subject(subject_id: str, body: SubjectUpdate, db: AsyncSession = Depends(get_db)):
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(subject, key, value)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A subject with this official code already exists."
        )
    return subject


@router.delete("/subjects/{subject_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[admin_only])
async def delete_subject(subject_id: str, db: AsyncSession = Depends(get_db)):
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
    try:
        await db.delete(subject)
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete subject because it is still used in classes, exams, timetables, or homework."
        )


# ── Enrollments ──────────────────────────────────────────────────────────

@router.post("/enrollments", response_model=EnrollmentResponse, dependencies=[admin_only])
async def create_enrollment(body: EnrollmentCreate, db: AsyncSession = Depends(get_db)):
    student = await db.get(StudentProfile, body.student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    cls = await db.get(Class, body.class_id)
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    year = await db.get(AcademicYear, body.academic_year_id)
    if not year:
        raise HTTPException(status_code=404, detail="Academic year not found")

    existing = await db.execute(
        select(Enrollment).where(
            Enrollment.student_id == body.student_id,
            Enrollment.academic_year_id == body.academic_year_id,
            Enrollment.status == "ACTIVE",
        )
    )
    if existing.first():
        raise HTTPException(status_code=409, detail="Student already enrolled in this academic year")

    enrollment = Enrollment(**body.model_dump())
    db.add(enrollment)
    await db.flush()
    return enrollment


@router.get("/enrollments", response_model=list[EnrollmentResponse])
async def list_enrollments(
    student_id: str | None = None,
    class_id: str | None = None,
    section_id: str | None = None,
    academic_year_id: str | None = None,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(Enrollment).order_by(Enrollment.enrolled_at.desc())
    if student_id:
        q = q.where(Enrollment.student_id == student_id)
    if class_id:
        q = q.where(Enrollment.class_id == class_id)
    if section_id:
        q = q.where(Enrollment.section_id == section_id)
    if academic_year_id:
        q = q.where(Enrollment.academic_year_id == academic_year_id)
    if status:
        q = q.where(Enrollment.status == status)
    result = await db.execute(q)
    return result.scalars().all()


@router.patch("/enrollments/{enrollment_id}", response_model=EnrollmentResponse, dependencies=[admin_only])
async def update_enrollment(enrollment_id: str, body: EnrollmentUpdate, db: AsyncSession = Depends(get_db)):
    enrollment = await db.get(Enrollment, enrollment_id)
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(enrollment, field, value)
    await db.flush()
    return enrollment


@router.get("/enrollments/{student_id}/history", response_model=list[EnrollmentResponse])
async def get_student_enrollment_history(
    student_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    q = select(Enrollment).where(Enrollment.student_id == student_id).order_by(Enrollment.enrolled_at.desc())
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/enrollments/transfer", response_model=EnrollmentResponse, dependencies=[admin_only])
async def transfer_enrollment(body: TransferCreate, db: AsyncSession = Depends(get_db)):
    student = await db.get(StudentProfile, body.student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    current = await db.execute(
        select(Enrollment).where(
            Enrollment.student_id == body.student_id,
            Enrollment.status == "ACTIVE",
        )
    )
    current_enrollment = current.scalar_one_or_none()
    now = datetime.now(timezone.utc)

    if current_enrollment:
        current_enrollment.status = "TRANSFERRED"
        current_enrollment.left_at = now

    new_enrollment = Enrollment(
        student_id=body.student_id,
        class_id=body.to_class_id,
        section_id=body.to_section_id,
        academic_year_id=body.to_academic_year_id,
        roll_number=body.roll_number,
        status="ACTIVE",
        enrolled_at=now,
    )
    db.add(new_enrollment)
    await db.flush()
    return new_enrollment


@router.get("/my-teaching-profile")
async def get_my_teaching_profile(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["id"]

    result = await db.execute(
        select(TeacherAssignment, Class, Section, Subject)
        .join(Class, TeacherAssignment.class_id == Class.id)
        .join(Section, TeacherAssignment.section_id == Section.id)
        .join(Subject, TeacherAssignment.subject_id == Subject.id)
        .where(TeacherAssignment.instructor_id == user_id)
        .order_by(Class.order, Section.name, Subject.name)
    )
    rows = result.all()

    assignments = []
    class_ids = set()
    subject_ids = set()
    section_ids = set()

    for ta, cls, sec, subj in rows:
        assignments.append({
            "id": str(ta.id),
            "class_id": str(cls.id),
            "class_name": cls.name,
            "class_order": cls.order,
            "section_id": str(sec.id),
            "section_name": sec.name,
            "section_capacity": sec.capacity,
            "subject_id": str(subj.id),
            "subject_name": subj.name,
            "subject_code": subj.code,
        })
        class_ids.add(str(cls.id))
        subject_ids.add(str(subj.id))
        section_ids.add(str(sec.id))

    ct_result = await db.execute(
        select(Section, Class)
        .join(Class, Section.class_id == Class.id)
        .where(Section.class_teacher_id == user_id)
    )
    for sec, cls in ct_result.all():
        assignments.append({
            "id": f"ct-{sec.id}",
            "class_id": str(cls.id),
            "class_name": cls.name,
            "class_order": cls.order,
            "section_id": str(sec.id),
            "section_name": sec.name,
            "section_capacity": sec.capacity,
            "subject_id": "class-teacher",
            "subject_name": "Class Teacher (Homeroom)",
            "subject_code": "CT",
        })
        class_ids.add(str(cls.id))
        section_ids.add(str(sec.id))

    return {
        "assignments": assignments,
        "summary": {
            "total_classes": len(class_ids),
            "total_sections": len(section_ids),
            "total_subjects": len(subject_ids),
            "total_assignments": len(assignments),
        },
    }


@router.get("/teacher-assignments", response_model=list[TeacherAssignmentResponse])
async def list_teacher_assignments(
    instructor_id: Optional[str] = None,
    section_id: Optional[str] = None,
    subject_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = admin_only,
):
    query = select(TeacherAssignment)
    if instructor_id:
        query = query.where(TeacherAssignment.instructor_id == instructor_id)
    if section_id:
        try:
            UUID(section_id)
        except ValueError:
            return []
        query = query.where(TeacherAssignment.section_id == section_id)
    if subject_id:
        query = query.where(TeacherAssignment.subject_id == subject_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/teacher-assignments/{assignment_id}", response_model=TeacherAssignmentResponse)
async def get_teacher_assignment(
    assignment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = admin_only,
):
    result = await db.execute(select(TeacherAssignment).where(TeacherAssignment.id == assignment_id))
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return assignment


@router.post("/teacher-assignments", response_model=TeacherAssignmentResponse, status_code=201)
async def create_teacher_assignment(
    body: TeacherAssignmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = admin_only,
):
    assignment = TeacherAssignment(
        instructor_id=body.instructor_id,
        section_id=body.section_id,
        subject_id=body.subject_id,
        class_id=body.class_id,
    )
    db.add(assignment)
    await db.flush()
    return assignment


@router.patch("/teacher-assignments/{assignment_id}", response_model=TeacherAssignmentResponse)
async def update_teacher_assignment(
    assignment_id: UUID,
    body: TeacherAssignmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = admin_only,
):
    result = await db.execute(select(TeacherAssignment).where(TeacherAssignment.id == assignment_id))
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(assignment, key, value)
    await db.flush()
    return assignment


@router.delete("/teacher-assignments/{assignment_id}", status_code=204)
async def delete_teacher_assignment(
    assignment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = admin_only,
):
    result = await db.execute(select(TeacherAssignment).where(TeacherAssignment.id == assignment_id))
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    await db.delete(assignment)
    await db.flush()