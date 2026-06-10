import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.academic.models import Enrollment, Section
from app.modules.admissions.models import Admission, can_transition
from app.modules.auth.models import StudentProfile, User
from app.modules.auth.service import create_user
from app.core.security import hash_password


def generate_admission_number() -> str:
    year = datetime.now(timezone.utc).strftime("%Y")
    uid = uuid.uuid4().hex[:6].upper()
    return f"ADM{year}{uid}"


async def transition_status(
    admission: Admission,
    next_status: str,
    user_id: str,
    db: AsyncSession,
) -> Admission:
    if not can_transition(admission.status, next_status):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot transition from {admission.status} to {next_status}",
        )
    admission.status = next_status
    await db.flush()
    return admission


async def count_enrolled(section_id: str, academic_year_id: str, db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count(Enrollment.student_id)).where(
            Enrollment.section_id == section_id,
            Enrollment.academic_year_id == academic_year_id,
            Enrollment.status == "ACTIVE",
        )
    )
    return result.scalar() or 0


async def enroll_student(
    admission: Admission,
    section_id: str,
    db: AsyncSession,
) -> StudentProfile:
    section_result = await db.execute(
        select(Section).where(Section.id == section_id).with_for_update()
    )
    section = section_result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")

    current = await count_enrolled(section_id, str(admission.academic_year_id), db)
    if current >= section.capacity:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Section is full",
        )

    temp_pw = uuid.uuid4().hex[:12]
    user = await create_user(
        db,
        email=admission.applicant_email,
        phone=admission.applicant_phone,
        password=temp_pw,
        role="student",
    )

    admission_number = generate_admission_number()
    student = StudentProfile(
        user_id=user.id,
        first_name=admission.applicant_name.split(" ", 1)[0],
        last_name=admission.applicant_name.split(" ", 1)[1] if " " in admission.applicant_name else "",
        admission_number=admission_number,
        guardian_name=admission.parent_name,
        guardian_phone=admission.parent_phone,
        address=admission.address,
        date_of_birth=admission.date_of_birth,
    )
    db.add(student)
    await db.flush()

    enrollment = Enrollment(
        student_id=student.id,
        class_id=section.class_id,
        section_id=section_id,
        academic_year_id=admission.academic_year_id,
        status="ACTIVE",
    )
    db.add(enrollment)
    admission.status = "ENROLLED"
    await db.flush()
    return student, temp_pw
