from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func as sa_func, select
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
    Holiday,
    Section,
    Subject,
    TeacherAssignment,
)
from app.modules.academic.service import PromotionError, promote_students
from app.modules.academic.schemas import (
    AcademicYearCreate,
    AcademicYearResponse,
    ClassCreate,
    ClassResponse,
    EnrollmentCreate,
    EnrollmentResponse,
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
    StudentCreate,
    StudentProfileResponse,
    StudentSearchResponse,
    StudentUpdate,
    SubjectCreate,
    SubjectResponse,
    TeacherAssignmentCreate,
    TeacherAssignmentUpdate,
    TeacherAssignmentResponse,
)
from app.modules.auth.models import StudentProfile, StaffProfile, User
from app.modules.academic.models import Class as AcademicClass

admin_only = role_required("super_admin", "principal")
all_auth = [Depends(get_current_user)]

router = APIRouter(prefix="/academic", tags=["academic"])


@router.get("/years", response_model=list[AcademicYearResponse])
async def list_years(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AcademicYear).order_by(AcademicYear.start_date.desc()))
    return result.scalars().all()


@router.post("/years", response_model=AcademicYearResponse, dependencies=[admin_only])
async def create_year(body: AcademicYearCreate, db: AsyncSession = Depends(get_db)):
    if body.is_active:
        await db.execute(
            select(AcademicYear).where(AcademicYear.is_active.is_(True))
        )
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
    result = await db.execute(select(Class).order_by(Class.order))
    return result.scalars().all()


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
        )
        for s in sections
    ]


@router.post("/sections", response_model=SectionResponse, dependencies=[admin_only])
async def create_section(body: SectionCreate, db: AsyncSession = Depends(get_db)):
    section = Section(**body.model_dump())
    db.add(section)
    await db.flush()
    return section


@router.get("/subjects", response_model=list[SubjectResponse])
async def list_subjects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Subject).order_by(Subject.name))
    return result.scalars().all()


@router.post("/subjects", response_model=SubjectResponse, dependencies=[admin_only])
async def create_subject(body: SubjectCreate, db: AsyncSession = Depends(get_db)):
    subject = Subject(**body.model_dump())
    db.add(subject)
    await db.flush()
    return subject


@router.get("/years/{year_id}", response_model=AcademicYearResponse)
async def get_year(year_id: str, db: AsyncSession = Depends(get_db)):
    year = await db.get(AcademicYear, year_id)
    if not year:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Academic year not found")
    return year


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


@router.post("/classes/{class_id}/subjects", dependencies=[admin_only])
async def link_subject(class_id: str, subject_id: str, db: AsyncSession = Depends(get_db)):
    link = ClassSubject(class_id=class_id, subject_id=subject_id)
    db.add(link)
    await db.flush()
    return {"ok": True}


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
    search: Optional[str] = None,
    page: int = 1,
    per_page: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    query = select(
        StudentProfile.id,
        StudentProfile.user_id,
        StudentProfile.first_name,
        StudentProfile.last_name,
        StudentProfile.date_of_birth,
        StudentProfile.admission_number,
        StudentProfile.class_id,
        StudentProfile.section_id,
        StudentProfile.guardian_name,
        StudentProfile.guardian_phone,
        StudentProfile.address,
        StudentProfile.created_at,
        AcademicClass.name.label("student_group_name"),
        User.email,
        User.is_active,
    ).join(User, StudentProfile.user_id == User.id).outerjoin(AcademicClass, StudentProfile.class_id == AcademicClass.id)

    if section_id:
        query = query.where(StudentProfile.section_id == section_id)

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
                date_of_birth=r.date_of_birth, admission_number=r.admission_number,
                class_id=r.class_id, student_group_name=r.student_group_name,
                guardian_name=r.guardian_name, guardian_phone=r.guardian_phone,
                address=r.address, email=r.email, is_active=r.is_active, creation=r.created_at,
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
            StaffProfile.id.label("profile_id"),
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
            id=r.profile_id or r.user_id,
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


@router.get("/students/{student_id}", response_model=StudentProfileResponse)
async def get_student(
    student_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(
        select(
            StudentProfile.id,
            StudentProfile.user_id,
            StudentProfile.first_name,
            StudentProfile.last_name,
            StudentProfile.date_of_birth,
            StudentProfile.admission_number,
            StudentProfile.class_id,
            StudentProfile.section_id,
            StudentProfile.guardian_name,
            StudentProfile.guardian_phone,
            StudentProfile.address,
            StudentProfile.created_at,
            AcademicClass.name.label("student_group_name"),
            User.email,
            User.is_active,
        ).join(User, StudentProfile.user_id == User.id)
        .outerjoin(AcademicClass, StudentProfile.class_id == AcademicClass.id)
        .where(StudentProfile.id == student_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    # Scope check
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

    return StudentProfileResponse(
        id=row.id,
        user_id=row.user_id,
        first_name=row.first_name,
        last_name=row.last_name,
        date_of_birth=row.date_of_birth,
        admission_number=row.admission_number,
        class_id=row.class_id,
        student_group_name=row.student_group_name,
        guardian_name=row.guardian_name,
        guardian_phone=row.guardian_phone,
        address=row.address,
        email=row.email,
        is_active=row.is_active,
        creation=row.created_at,
    )


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
        admission_number=f"STU-{user.id}"[:50],
        class_id=body.class_id,
        guardian_name=body.guardian_name,
        guardian_phone=body.guardian_phone,
        address=body.address,
    )
    db.add(profile)
    await db.flush()
    return await get_student(str(profile.id), db)


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
    if body.class_id is not None:
        profile.class_id = body.class_id
    if body.guardian_name is not None:
        profile.guardian_name = body.guardian_name
    if body.guardian_phone is not None:
        profile.guardian_phone = body.guardian_phone
    if body.address is not None:
        profile.address = body.address
    user = await db.get(User, profile.user_id)
    if user and body.is_active is not None:
        user.is_active = body.is_active
    await db.flush()
    return await get_student(student_id, db)


@router.delete("/students/{student_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[admin_only])
async def delete_student(student_id: str, db: AsyncSession = Depends(get_db)):
    profile = await db.get(StudentProfile, student_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    user = await db.get(User, profile.user_id)
    if user:
        user.deleted_at = datetime.now(timezone.utc)
        user.is_active = False
    await db.flush()


@router.get("/students/search", response_model=list[StudentSearchResponse])
async def search_students(
    q: str = "",
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    role = current_user["role"]
    if role not in ("super_admin", "principal", "teacher", "librarian", "accountant", "parent"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    query = select(
        StudentProfile.id,
        StudentProfile.first_name,
        StudentProfile.last_name,
        StudentProfile.admission_number,
        StudentProfile.class_id,
        StudentProfile.section_id,
        AcademicClass.name.label("student_group_name"),
        Section.name.label("section_name"),
        User.email,
    ).join(User, StudentProfile.user_id == User.id
    ).outerjoin(AcademicClass, StudentProfile.class_id == AcademicClass.id
    ).outerjoin(Section, StudentProfile.section_id == Section.id)

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

    # Scope check
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
        sp = await db.execute(
            select(StudentProfile).where(
                StudentProfile.user_id == uid,
                StudentProfile.section_id == section_id,
            )
        )
        if not sp.first():
            raise HTTPException(status_code=403, detail="Access denied")
    elif role == "parent":
        from app.modules.parent.models import ParentStudentLink
        p = await db.execute(
            select(ParentStudentLink).join(
                StudentProfile,
                ParentStudentLink.student_id == StudentProfile.id,
            ).where(
                ParentStudentLink.parent_id == uid,
                StudentProfile.section_id == section_id,
            )
        )
        if not p.first():
            raise HTTPException(status_code=403, detail="Access denied")

    students_result = await db.execute(
        select(
            StudentProfile.id,
            StudentProfile.user_id,
            StudentProfile.first_name,
            StudentProfile.last_name,
            StudentProfile.date_of_birth,
            StudentProfile.admission_number,
            StudentProfile.class_id,
            StudentProfile.guardian_name,
            StudentProfile.guardian_phone,
            StudentProfile.address,
            StudentProfile.created_at,
            AcademicClass.name.label("student_group_name"),
            User.email,
            User.is_active,
        ).join(User, StudentProfile.user_id == User.id)
        .outerjoin(AcademicClass, StudentProfile.class_id == AcademicClass.id)
        .where(StudentProfile.section_id == section_id)
    )
    students = [
        StudentProfileResponse(
            id=r.id, user_id=r.user_id, first_name=r.first_name, last_name=r.last_name,
            date_of_birth=r.date_of_birth, admission_number=r.admission_number,
            class_id=r.class_id, student_group_name=r.student_group_name,
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
        students=students,
    )


@router.patch("/sections/{section_id}", response_model=SectionResponse, dependencies=[admin_only])
async def update_section(
    section_id: str,
    name: str | None = None,
    capacity: int | None = None,
    class_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    section = await db.get(Section, section_id)
    if not section:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    if name is not None:
        section.name = name
    if capacity is not None:
        section.capacity = capacity
    if class_id is not None:
        section.class_id = class_id
    await db.flush()
    return section


# ── Class / Subject Update ────────────────────────────────────────────────


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
async def update_subject(subject_id: str, name: str | None = None, code: str | None = None, is_graded: bool | None = None, db: AsyncSession = Depends(get_db)):
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
    if name is not None:
        subject.name = name
    if code is not None:
        subject.code = code
    if is_graded is not None:
        subject.is_graded = is_graded
    await db.flush()
    return subject


# ── Program Enrollments ──────────────────────────────────────────────────


@router.post("/enrollments", response_model=EnrollmentResponse, dependencies=[admin_only])
async def create_enrollment(body: EnrollmentCreate, db: AsyncSession = Depends(get_db)):
    profile = await db.get(StudentProfile, body.student_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    cls = await db.get(Class, body.class_id)
    if not cls:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
    profile.class_id = body.class_id
    await db.flush()
    return EnrollmentResponse(
        id=str(profile.id),
        student_id=profile.id,
        student_name=f"{profile.first_name} {profile.last_name}",
        class_id=cls.id,
        class_name=cls.name,
        enrollment_date=profile.updated_at,
    )


@router.get("/enrollments", response_model=list[EnrollmentResponse])
async def list_enrollments(
    student_id: str | None = None,
    class_id: str | None = None,
    academic_year_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(
        StudentProfile.id.label("profile_id"),
        StudentProfile.class_id,
        StudentProfile.created_at,
        User.email,
        AcademicClass.name.label("class_name"),
    ).join(User, StudentProfile.user_id == User.id
    ).outerjoin(AcademicClass, StudentProfile.class_id == AcademicClass.id)
    if student_id:
        q = q.where(StudentProfile.id == student_id)
    if class_id:
        q = q.where(StudentProfile.class_id == class_id)
    result = await db.execute(q)
    rows = result.all()
    return [
        EnrollmentResponse(
            id=str(r.profile_id),
            student_id=r.profile_id,
            student_name=r.email or "",
            class_id=r.class_id,
            class_name=r.class_name,
            enrollment_date=r.created_at,
        )
        for r in rows
    ]


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
    await db.commit()
    await db.refresh(assignment)
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
    await db.commit()
    await db.refresh(assignment)
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
    await db.commit()
