from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.expression import BinaryExpression

from app.core.database import get_db
from app.core.security import decode_token
from app.modules.auth.models import User

security_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    role = payload.get("role")
    token_type = payload.get("type")
    if not user_id or token_type != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
    result = await db.execute(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    if user.role != role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Role mismatch - token revoked",
        )
    return {"id": str(user.id), "role": user.role}


def role_required(*allowed_roles: str):
    async def _check(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user
    return Depends(_check)


TEACHER_ROLES = {"super_admin", "principal", "teacher"}


class QueryScoper:
    """Auto-applies WHERE clauses to list queries based on current_user.role."""

    @staticmethod
    def for_students(db, current_user: dict) -> Optional[BinaryExpression]:
        from app.modules.academic.models import Enrollment, TeacherAssignment
        from app.modules.auth.models import StudentProfile
        from app.modules.parent.models import ParentStudentLink

        role = current_user["role"]
        uid = current_user["id"]

        if role in ("super_admin", "principal", "accountant", "librarian"):
            return None

        if role == "teacher":
            from sqlalchemy import and_, or_
            from app.modules.academic.models import Section
            ta = TeacherAssignment.__table__.alias()
            ta_subq = (
                select(ta.c.section_id)
                .where(ta.c.instructor_id == uid)
                .subquery()
            )
            sec = Section.__table__.alias()
            ct_subq = (
                select(sec.c.id)
                .where(sec.c.class_teacher_id == uid)
                .subquery()
            )
            enrollment = Enrollment.__table__.alias()
            return and_(
                StudentProfile.id == enrollment.c.student_id,
                or_(
                    enrollment.c.section_id.in_(ta_subq),
                    enrollment.c.section_id.in_(ct_subq)
                ),
                enrollment.c.status == "ACTIVE",
            )

        if role == "student":
            from sqlalchemy import and_
            enrollment = Enrollment.__table__.alias()
            sp_subq = (
                select(StudentProfile.id)
                .where(StudentProfile.user_id == uid)
                .scalar_subquery()
            )
            return and_(
                StudentProfile.id == sp_subq,
                StudentProfile.id == enrollment.c.student_id,
                enrollment.c.status == "ACTIVE",
            )

        if role == "parent":
            from sqlalchemy import and_
            enrollment = Enrollment.__table__.alias()
            psl = ParentStudentLink.__table__.alias()
            child_subq = (
                select(psl.c.student_id)
                .where(psl.c.parent_id == uid)
                .subquery()
            )
            return and_(
                StudentProfile.id.in_(child_subq),
                StudentProfile.id == enrollment.c.student_id,
                enrollment.c.status == "ACTIVE",
            )

        return None

    @staticmethod
    def for_attendance(db, current_user: dict) -> Optional[BinaryExpression]:
        from app.modules.academic.models import TeacherAssignment
        from app.modules.auth.models import StudentProfile
        from app.modules.attendance.models import Attendance
        from app.modules.parent.models import ParentStudentLink

        role = current_user["role"]
        uid = current_user["id"]

        if role in ("super_admin", "principal", "accountant", "librarian"):
            return None

        if role == "teacher":
            from sqlalchemy import or_
            from app.modules.academic.models import Enrollment, Section
            ta = TeacherAssignment.__table__.alias()
            ta_subq = (
                select(ta.c.section_id)
                .where(ta.c.instructor_id == uid)
                .subquery()
            )
            sec = Section.__table__.alias()
            ct_subq = (
                select(sec.c.id)
                .where(sec.c.class_teacher_id == uid)
                .subquery()
            )
            enrollment = Enrollment.__table__.alias()
            student_ids = (
                select(StudentProfile.id)
                .where(
                    StudentProfile.id == enrollment.c.student_id,
                    or_(
                        enrollment.c.section_id.in_(ta_subq),
                        enrollment.c.section_id.in_(ct_subq)
                    ),
                    enrollment.c.status == "ACTIVE",
                )
                .subquery()
            )
            return Attendance.student_id.in_(student_ids)

        if role == "student":
            sp = (
                select(StudentProfile.id)
                .where(StudentProfile.user_id == uid)
                .scalar_subquery()
            )
            return Attendance.student_id == sp

        if role == "parent":
            psl = ParentStudentLink.__table__.alias()
            child_ids = (
                select(psl.c.student_id)
                .where(psl.c.parent_id == uid)
                .subquery()
            )
            return Attendance.student_id.in_(child_ids)

        return None

    @staticmethod
    def for_leaves(db, current_user: dict) -> Optional[BinaryExpression]:
        from app.modules.academic.models import TeacherAssignment
        from app.modules.auth.models import StudentProfile
        from app.modules.attendance.models import LeaveApplication
        from app.modules.parent.models import ParentStudentLink

        role = current_user["role"]
        uid = current_user["id"]

        if role in ("super_admin", "principal", "accountant", "librarian"):
            return None

        if role == "teacher":
            from app.modules.academic.models import Enrollment
            ta = TeacherAssignment.__table__.alias()
            section_ids = (
                select(ta.c.section_id)
                .where(ta.c.instructor_id == uid)
                .subquery()
            )
            enrollment = Enrollment.__table__.alias()
            student_ids = (
                select(StudentProfile.id)
                .where(
                    StudentProfile.id == enrollment.c.student_id,
                    enrollment.c.section_id.in_(section_ids),
                    enrollment.c.status == "ACTIVE",
                )
                .subquery()
            )
            return LeaveApplication.student_id.in_(student_ids)

        if role == "student":
            sp = (
                select(StudentProfile.id)
                .where(StudentProfile.user_id == uid)
                .scalar_subquery()
            )
            return LeaveApplication.student_id == sp

        if role == "parent":
            psl = ParentStudentLink.__table__.alias()
            child_ids = (
                select(psl.c.student_id)
                .where(psl.c.parent_id == uid)
                .subquery()
            )
            return LeaveApplication.student_id.in_(child_ids)

        return None

    @staticmethod
    def for_homework(db, current_user: dict) -> Optional[BinaryExpression]:
        from app.modules.academic.models import Section, TeacherAssignment
        from app.modules.auth.models import StudentProfile
        from app.modules.homework.models import HomeworkAssignment
        from app.modules.parent.models import ParentStudentLink

        role = current_user["role"]
        uid = current_user["id"]

        if role in ("super_admin", "principal", "accountant", "librarian"):
            return None

        if role == "teacher":
            from app.modules.auth.models import StaffProfile
            sp = (
                select(StaffProfile.id)
                .where(StaffProfile.user_id == uid)
                .scalar_subquery()
            )
            return HomeworkAssignment.created_by_id == sp

        if role == "student":
            from app.modules.academic.models import Enrollment
            enrollment = Enrollment.__table__.alias()
            sp_enrollment = (
                select(enrollment.c.section_id)
                .where(
                    StudentProfile.user_id == uid,
                    StudentProfile.id == enrollment.c.student_id,
                    enrollment.c.status == "ACTIVE",
                )
                .scalar_subquery()
            )
            section_name = (
                select(Section.name)
                .where(Section.id == sp_enrollment)
                .scalar_subquery()
            )
            return HomeworkAssignment.student_group == section_name

        if role == "parent":
            from app.modules.academic.models import Enrollment
            psl = ParentStudentLink.__table__.alias()
            enrollment = Enrollment.__table__.alias()
            child_ids = (
                select(psl.c.student_id)
                .where(psl.c.parent_id == uid)
                .subquery()
            )
            child_section_ids = (
                select(enrollment.c.section_id)
                .where(
                    enrollment.c.student_id.in_(child_ids),
                    enrollment.c.status == "ACTIVE",
                )
                .subquery()
            )
            section_names = (
                select(Section.name)
                .where(Section.id.in_(child_section_ids))
                .subquery()
            )
            return HomeworkAssignment.student_group.in_(section_names)

        return None

    @staticmethod
    def for_timetable_slots(db, current_user: dict) -> Optional[BinaryExpression]:
        from app.modules.academic.models import TeacherAssignment
        from app.modules.auth.models import StaffProfile, StudentProfile
        from app.modules.parent.models import ParentStudentLink
        from app.modules.timetable.models import TimetableSlot

        role = current_user["role"]
        uid = current_user["id"]

        if role in ("super_admin", "principal", "accountant", "librarian"):
            return None

        if role == "teacher":
            sp = (
                select(StaffProfile.id)
                .where(StaffProfile.user_id == uid)
                .scalar_subquery()
            )
            return TimetableSlot.instructor_id == sp

        if role == "student":
            from app.modules.academic.models import Enrollment
            enrollment = Enrollment.__table__.alias()
            sec = (
                select(enrollment.c.section_id)
                .where(
                    StudentProfile.user_id == uid,
                    StudentProfile.id == enrollment.c.student_id,
                    enrollment.c.status == "ACTIVE",
                )
                .scalar_subquery()
            )
            return TimetableSlot.section_id == sec

        if role == "parent":
            from app.modules.academic.models import Enrollment
            psl = ParentStudentLink.__table__.alias()
            enrollment = Enrollment.__table__.alias()
            child_section_ids = (
                select(enrollment.c.section_id)
                .where(
                    enrollment.c.student_id.in_(
                        select(psl.c.student_id).where(psl.c.parent_id == uid).subquery()
                    ),
                    enrollment.c.status == "ACTIVE",
                )
                .subquery()
            )
            return TimetableSlot.section_id.in_(child_section_ids)

        return None

    @staticmethod
    def for_invoices(db, current_user: dict) -> Optional[BinaryExpression]:
        from app.modules.auth.models import StudentProfile
        from app.modules.fees.models import Invoice
        from app.modules.parent.models import ParentStudentLink

        role = current_user["role"]
        uid = current_user["id"]

        if role in ("super_admin", "principal", "accountant", "librarian"):
            return None

        if role == "student":
            sp = (
                select(StudentProfile.id)
                .where(StudentProfile.user_id == uid)
                .scalar_subquery()
            )
            return Invoice.student_id == sp

        if role == "parent":
            from app.modules.academic.models import Enrollment
            enrollment = Enrollment.__table__.alias()
            psl = ParentStudentLink.__table__.alias()
            child_ids = (
                select(psl.c.student_id)
                .where(psl.c.parent_id == uid)
                .subquery()
            )
            active_enrolled_ids = (
                select(enrollment.c.student_id)
                .where(
                    enrollment.c.student_id.in_(child_ids),
                    enrollment.c.status == "ACTIVE",
                )
                .subquery()
            )
            return Invoice.student_id.in_(active_enrolled_ids)

        return None

    @staticmethod
    def for_orders(db, current_user: dict) -> Optional[BinaryExpression]:
        from app.modules.auth.models import StudentProfile
        from app.modules.fees.models import Invoice, PaymentOrder
        from app.modules.parent.models import ParentStudentLink

        role = current_user["role"]
        uid = current_user["id"]

        if role in ("super_admin", "principal", "accountant", "librarian"):
            return None

        if role == "student":
            sp = (
                select(StudentProfile.id)
                .where(StudentProfile.user_id == uid)
                .scalar_subquery()
            )
            invoice_student_ids = (
                select(Invoice.id)
                .where(Invoice.student_id == sp)
                .subquery()
            )
            return PaymentOrder.invoice_id.in_(invoice_student_ids)

        if role == "parent":
            psl = ParentStudentLink.__table__.alias()
            child_ids = (
                select(psl.c.student_id)
                .where(psl.c.parent_id == uid)
                .subquery()
            )
            invoice_ids = (
                select(Invoice.id)
                .where(Invoice.student_id.in_(child_ids))
                .subquery()
            )
            return PaymentOrder.invoice_id.in_(invoice_ids)

        return None

    @staticmethod
    def for_ledger(db, current_user: dict) -> Optional[BinaryExpression]:
        from app.modules.auth.models import StudentProfile
        from app.modules.fees.models import StudentLedgerEntry
        from app.modules.parent.models import ParentStudentLink

        role = current_user["role"]
        uid = current_user["id"]

        if role in ("super_admin", "principal", "accountant", "librarian"):
            return None

        if role == "teacher":
            from sqlalchemy import or_
            from app.modules.academic.models import (
                Enrollment,
                Section,
                TeacherAssignment,
            )

            ta = TeacherAssignment.__table__.alias()
            ta_subq = (
                select(ta.c.section_id)
                .where(ta.c.instructor_id == uid)
                .subquery()
            )
            sec = Section.__table__.alias()
            ct_subq = (
                select(sec.c.id)
                .where(sec.c.class_teacher_id == uid)
                .subquery()
            )
            enrollment = Enrollment.__table__.alias()
            student_ids = (
                select(StudentProfile.id)
                .where(
                    StudentProfile.id == enrollment.c.student_id,
                    or_(
                        enrollment.c.section_id.in_(ta_subq),
                        enrollment.c.section_id.in_(ct_subq),
                    ),
                    enrollment.c.status == "ACTIVE",
                )
                .subquery()
            )
            return StudentLedgerEntry.student_id.in_(student_ids)

        if role == "student":
            sp = (
                select(StudentProfile.id)
                .where(StudentProfile.user_id == uid)
                .scalar_subquery()
            )
            return StudentLedgerEntry.student_id == sp

        if role == "parent":
            psl = ParentStudentLink.__table__.alias()
            child_ids = (
                select(psl.c.student_id)
                .where(psl.c.parent_id == uid)
                .subquery()
            )
            return StudentLedgerEntry.student_id.in_(child_ids)

        return None
