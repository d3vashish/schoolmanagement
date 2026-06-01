import uuid
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.academic.models import AcademicYear, Class as AcademicClass, Subject
from app.modules.attendance.models import Attendance, LeaveType
from app.core.security import hash_password
from app.modules.auth.models import ParentProfile, StudentProfile, User
from app.modules.fees.models import FeeHead, FeeInstallment, FeeStructure, Invoice
from app.modules.library.models import Book, BookCategory, BookCopy, BookIssue
from app.modules.parent.models import ParentStudentLink
from app.modules.staff.models import PayrollRecord, PayrollRun


async def create_user(
    db: AsyncSession,
    email: str | None = None,
    phone: str | None = None,
    role: str = "student",
    is_active: bool = True,
) -> User:
    uid = uuid.uuid4()
    user = User(
        id=uid,
        email=email or f"{role}_{uid.hex[:8]}@test.edu",
        phone=phone or f"999999{uuid.uuid4().hex[:6]}",
        hashed_pw=hash_password("dummy"),
        role=role,
        is_active=is_active,
    )
    db.add(user)
    await db.flush()
    return user


async def create_student_profile(
    db: AsyncSession,
    user_id: uuid.UUID | None = None,
    class_id: uuid.UUID | None = None,
    admission_number: str | None = None,
) -> StudentProfile:
    if user_id is None:
        user = await create_user(db, role="student")
        user_id = user.id
    profile = StudentProfile(
        user_id=user_id,
        first_name="Test",
        last_name="Student",
        admission_number=admission_number or f"ADM{uuid.uuid4().hex[:8].upper()}",
        class_id=class_id,
    )
    db.add(profile)
    await db.flush()
    return profile


async def create_academic_year(db: AsyncSession) -> AcademicYear:
    ay = AcademicYear(
        name="2026-2027",
        start_date=date(2026, 4, 1),
        end_date=date(2027, 3, 31),
        is_active=True,
    )
    db.add(ay)
    await db.flush()
    return ay


async def create_class(db: AsyncSession, ay_id: uuid.UUID) -> AcademicClass:
    cls = AcademicClass(name="Class 10", order=10)
    db.add(cls)
    await db.flush()
    return cls


async def create_subject(db: AsyncSession, name: str = "Mathematics") -> Subject:
    subj = Subject(name=name, code=name[:3].upper() + uuid.uuid4().hex[:4], is_graded=True)
    db.add(subj)
    await db.flush()
    return subj


async def create_fee_structure(
    db: AsyncSession, class_id: uuid.UUID, ay_id: uuid.UUID
) -> tuple:
    head = FeeHead(name="Tuition", is_taxable=False)
    db.add(head)
    await db.flush()

    structure = FeeStructure(
        academic_year_id=ay_id, class_id=class_id, fee_head_id=head.id, amount=10000
    )
    db.add(structure)
    await db.flush()

    installment = FeeInstallment(
        structure_id=structure.id, name="Term 1", due_date=date(2026, 7, 15), percent=100
    )
    db.add(installment)
    await db.flush()

    return head, structure, installment


async def create_invoice(
    db: AsyncSession,
    student_id: uuid.UUID,
    installment_id: uuid.UUID,
    amount: float = 10000,
    due_date: date | None = None,
    status: str = "PENDING",
) -> Invoice:
    inv = Invoice(
        student_id=student_id,
        installment_id=installment_id,
        gross_amount=amount,
        discount_amount=0,
        net_amount=amount,
        due_date=due_date or date(2025, 1, 1),
        status=status,
        late_fee_per_day=5,
        late_fee_max=500,
    )
    db.add(inv)
    await db.flush()
    return inv


async def create_leave_type(db: AsyncSession) -> LeaveType:
    lt = LeaveType(name="Sick", is_paid=True)
    db.add(lt)
    await db.flush()
    return lt


async def create_book_category(db: AsyncSession) -> BookCategory:
    cat = BookCategory(name="Fiction")
    db.add(cat)
    await db.flush()
    return cat


async def create_book_with_copy(
    db: AsyncSession, category_id: uuid.UUID
) -> tuple[Book, BookCopy]:
    book = Book(title="Test Book", author="Author", category_id=category_id, total_copies=1)
    db.add(book)
    await db.flush()

    copy = BookCopy(book_id=book.id, barcode=f"BC{uuid.uuid4().hex[:8]}")
    db.add(copy)
    await db.flush()
    return book, copy


async def create_payroll_run(
    db: AsyncSession, year: int = 2026, month: int = 5
) -> PayrollRun:
    run = PayrollRun(
        run_id=f"{year}-{month:02d}", year=year, month=month
    )
    db.add(run)
    await db.flush()
    return run


async def create_payroll_record(
    db: AsyncSession, run_id: str, staff_id: uuid.UUID, gross: float = 50000
) -> PayrollRecord:
    rec = PayrollRecord(
        run_id=run_id,
        staff_id=staff_id,
        monthly_gross=gross,
        net_pay=gross * 0.76,
        pf_employee=gross * 0.12,
        pf_employer=gross * 0.12,
        esic=gross * 0.0075,
    )
    db.add(rec)
    await db.flush()
    return rec


async def create_parent_with_child(
    db: AsyncSession,
) -> tuple[User, User, StudentProfile, ParentStudentLink]:
    parent_user = await create_user(db, role="parent", email="parent@test.edu")
    student_user = await create_user(db, role="student")
    student = await create_student_profile(db, user_id=student_user.id)

    link = ParentStudentLink(parent_id=parent_user.id, student_id=student.id, relationship="Father")
    db.add(link)
    await db.flush()
    return parent_user, student_user, student, link
