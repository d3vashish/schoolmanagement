from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.academic.models import AcademicYear
from app.modules.fees.models import FeeHead, FeeReceipt, FeeStructure, StudentDiscount


async def get_current_academic_year(db: AsyncSession) -> AcademicYear | None:
    result = await db.execute(
        select(AcademicYear).where(AcademicYear.is_active.is_(True))
    )
    return result.scalar_one_or_none()


async def get_fee_structure(class_id: str, academic_year_id: str, db: AsyncSession) -> list[FeeStructure]:
    result = await db.execute(
        select(FeeStructure)
        .where(FeeStructure.class_id == class_id, FeeStructure.academic_year_id == academic_year_id)
    )
    return result.scalars().all()


async def get_structures_detailed(
    db: AsyncSession,
    academic_year_id: str | None = None,
    class_id: str | None = None,
) -> list[dict]:
    """
    Returns fee structures joined with class name and fee head name (both stored
    as foreign keys on FeeStructure, not human-readable on their own). Used by
    the Structures dashboard tab, which otherwise has nothing readable to show
    besides raw UUIDs and amounts.
    """
    from app.modules.academic.models import Class

    q = (
        select(
            FeeStructure.id,
            FeeStructure.academic_year_id,
            FeeStructure.class_id,
            Class.name.label("class_name"),
            Class.order.label("class_order"),
            FeeStructure.fee_head_id,
            FeeHead.name.label("fee_head_name"),
            FeeStructure.amount,
            FeeStructure.is_new_student,
        )
        .select_from(FeeStructure)
        .join(Class, Class.id == FeeStructure.class_id)
        .join(FeeHead, FeeHead.id == FeeStructure.fee_head_id)
        .order_by(Class.order, FeeStructure.is_new_student)
    )

    if academic_year_id:
        q = q.where(FeeStructure.academic_year_id == academic_year_id)
    if class_id:
        q = q.where(FeeStructure.class_id == class_id)

    result = await db.execute(q)
    rows = result.all()

    return [
        {
            "id": row.id,
            "academic_year_id": row.academic_year_id,
            "class_id": row.class_id,
            "class_name": row.class_name,
            "fee_head_id": row.fee_head_id,
            "fee_head_name": row.fee_head_name,
            "amount": row.amount,
            "is_new_student": row.is_new_student,
        }
        for row in rows
    ]


async def get_student_discounts(student_id: str, db: AsyncSession) -> list[StudentDiscount]:
    result = await db.execute(
        select(StudentDiscount).where(StudentDiscount.student_id == student_id)
    )
    return result.scalars().all()


async def is_new_student_for_year(student_id: str, academic_year_id: str, db: AsyncSession) -> bool:
    """
    A student counts as "new" for a given academic year if their EARLIEST
    enrollment record (across all years) falls in that same academic year.
    If they have any enrollment from an earlier year, they're continuing
    ("old"), even if they've since moved up a class or section.
    """
    from app.modules.academic.models import Enrollment

    earliest = await db.execute(
        select(Enrollment.academic_year_id)
        .where(Enrollment.student_id == student_id)
        .order_by(Enrollment.enrolled_at.asc())
        .limit(1)
    )
    earliest_year_id = earliest.scalar_one_or_none()

    # No enrollment history at all (shouldn't normally happen) - treat as new.
    if earliest_year_id is None:
        return True

    return str(earliest_year_id) == str(academic_year_id)


async def get_student_owed_amount(student_id: str, academic_year_id: str, db: AsyncSession) -> Decimal:
    """
    Computes what a student owes for an academic year: the sum of every
    FeeStructure row for their class + year, combined across all fee heads
    (no per-head breakdown - matches the "combined total only" model).
    Picks only the old/new student structure rows matching their status,
    same as the old invoice-generation logic did, so they aren't billed
    for both the new-student and continuing-student rows for their class.
    """
    from app.modules.academic.models import Enrollment

    enrollment_result = await db.execute(
        select(Enrollment).where(
            Enrollment.student_id == student_id,
            Enrollment.status == "ACTIVE",
        )
    )
    enrollment = enrollment_result.scalar_one_or_none()
    if not enrollment:
        return Decimal("0")

    is_new = await is_new_student_for_year(student_id, academic_year_id, db)
    all_structures = await get_fee_structure(str(enrollment.class_id), academic_year_id, db)
    structures = [s for s in all_structures if s.is_new_student == is_new]

    return sum((s.amount for s in structures), Decimal("0"))


async def get_student_paid_amount(student_id: str, academic_year_id: str, db: AsyncSession) -> Decimal:
    result = await db.execute(
        select(func.coalesce(func.sum(FeeReceipt.amount), 0))
        .where(
            FeeReceipt.student_id == student_id,
            FeeReceipt.academic_year_id == academic_year_id,
        )
    )
    return Decimal(result.scalar() or 0)


async def get_student_fee_summary(student_id: str, academic_year_id: str, db: AsyncSession) -> dict:
    owed = await get_student_owed_amount(student_id, academic_year_id, db)
    paid = await get_student_paid_amount(student_id, academic_year_id, db)
    remaining = owed - paid
    if remaining <= 0 and owed > 0:
        pay_status = "PAID"
    elif paid > 0:
        pay_status = "PARTIAL"
    else:
        pay_status = "UNPAID"
    return {
        "student_id": student_id,
        "academic_year_id": academic_year_id,
        "owed": owed,
        "paid": paid,
        "remaining": remaining,
        "status": pay_status,
    }


async def generate_receipt_number(db: AsyncSession) -> str:
    """
    Sequential, human-readable receipt numbers like RCPT-2026-000123.
    Counts existing receipts for the current calendar year and increments.
    Not safe against a race between two simultaneous payments (would need
    a DB sequence or SELECT ... FOR UPDATE for that), but fine for a single
    accountant entering payments one at a time.
    """
    from datetime import date as date_cls

    year = date_cls.today().year
    count_result = await db.execute(
        select(func.count(FeeReceipt.id)).where(
            FeeReceipt.receipt_number.like(f"RCPT-{year}-%")
        )
    )
    count = count_result.scalar() or 0
    return f"RCPT-{year}-{count + 1:06d}"


async def record_fee_payment(
    db: AsyncSession,
    student_id: str,
    academic_year_id: str,
    amount: Decimal,
    mode: str,
    reference_no: str | None,
    received_by: str,
    notes: str | None,
) -> FeeReceipt:
    if amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Amount must be greater than zero")

    receipt_number = await generate_receipt_number(db)
    receipt = FeeReceipt(
        receipt_number=receipt_number,
        student_id=student_id,
        academic_year_id=academic_year_id,
        amount=amount,
        mode=mode,
        reference_no=reference_no,
        notes=notes,
        received_by=received_by,
    )
    db.add(receipt)
    await db.flush()  # so receipt.id exists for ref_id below

    # Keep the student ledger in sync with FeeReceipt. Without this, payments
    # show up in get_student_fee_summary/get_class_summary (Dashboard) but
    # never in get_ledger_summary (Student tab), since nothing else writes
    # PAYMENT rows to StudentLedgerEntry. Same pattern approve_journal_entry()
    # already uses for ADJUSTMENT_DEBIT / ADJUSTMENT_CREDIT entries.
    await post_to_ledger(
        db,
        student_id=student_id,
        entry_type="PAYMENT",
        amount=amount,
        ref_type="FeeReceipt",
        ref_id=str(receipt.id),
        description=f"Payment received via {mode}" + (f" (Ref: {reference_no})" if reference_no else ""),
        created_by=received_by,
    )

    await db.flush()
    return receipt


async def get_student_receipts(
    db: AsyncSession,
    student_id: str,
    academic_year_id: str | None = None,
) -> list[FeeReceipt]:
    q = select(FeeReceipt).where(FeeReceipt.student_id == student_id).order_by(FeeReceipt.created_at.desc())
    if academic_year_id:
        q = q.where(FeeReceipt.academic_year_id == academic_year_id)
    result = await db.execute(q)
    return result.scalars().all()


async def get_defaulters(
    db: AsyncSession,
    academic_year_id: str | None = None,
    section_id: str | None = None,
) -> list[dict]:
    """
    A defaulter is any student who still owes money (remaining > 0) for the
    academic year, at any point during the year - no due-date/overdue concept
    anymore since fees can be paid any time during the year.
    """
    from app.modules.academic.models import AcademicYear as AY, Enrollment, Section
    from app.modules.auth.models import StudentProfile, User

    if not academic_year_id:
        ay = await db.execute(select(AY.id).where(AY.is_active.is_(True)))
        academic_year_id = ay.scalar_one_or_none()
        if not academic_year_id:
            return []

    enrollment_q = (
        select(
            StudentProfile.id,
            User.full_name,
            Section.name.label("section_name"),
        )
        .select_from(StudentProfile)
        .join(User, User.id == StudentProfile.user_id)
        .join(Enrollment, (Enrollment.student_id == StudentProfile.id) & (Enrollment.status == "ACTIVE"))
        .join(Section, Section.id == Enrollment.section_id)
        .where(User.deleted_at.is_(None), User.is_active.is_(True))
        .where(Enrollment.academic_year_id == academic_year_id)
    )
    if section_id:
        enrollment_q = enrollment_q.where(Enrollment.section_id == section_id)

    result = await db.execute(enrollment_q)
    rows = result.all()

    defaulters = []
    for row in rows:
        summary = await get_student_fee_summary(str(row.id), str(academic_year_id), db)
        if summary["remaining"] > 0:
            defaulters.append({
                "student_id": str(row.id),
                "student_name": row.full_name,
                "section": row.section_name,
                "total_due": summary["owed"],
                "total_paid": summary["paid"],
                "balance": summary["remaining"],
                "overdue_count": 0,
            })

    defaulters.sort(key=lambda d: d["balance"], reverse=True)
    return defaulters


async def get_collection_report(
    db: AsyncSession,
    from_date: str | None = None,
    to_date: str | None = None,
) -> list[dict]:
    q = select(
        func.date(FeeReceipt.created_at).label("payment_date"),
        func.coalesce(func.sum(FeeReceipt.amount), 0).label("total_collected"),
        func.count(FeeReceipt.id).label("payment_count"),
    )

    if from_date:
        q = q.where(func.date(FeeReceipt.created_at) >= from_date)
    if to_date:
        q = q.where(func.date(FeeReceipt.created_at) <= to_date)

    q = q.group_by(func.date(FeeReceipt.created_at))
    q = q.order_by(func.date(FeeReceipt.created_at).desc())

    result = await db.execute(q)
    rows = result.all()

    return [
        {
            "date": row.payment_date,
            "total_collected": row.total_collected,
            "payment_count": row.payment_count,
            "mode_breakdown": None,
        }
        for row in rows
    ]


async def post_to_ledger(
    db: AsyncSession,
    student_id: str,
    entry_type: str,
    amount: Decimal,
    ref_type: str,
    ref_id: str | None,
    description: str | None,
    created_by: str | None,
) -> object:
    from app.modules.fees.models import StudentLedgerEntry

    last = await db.execute(
        select(StudentLedgerEntry.running_balance)
        .where(StudentLedgerEntry.student_id == student_id)
        .order_by(StudentLedgerEntry.created_at.desc())
        .limit(1)
    )
    prev_balance = last.scalar() or Decimal("0")

    if entry_type in ("INVOICE", "ADJUSTMENT_DEBIT"):
        delta = amount
    else:
        delta = -amount

    running = prev_balance + delta

    entry = StudentLedgerEntry(
        student_id=student_id,
        entry_type=entry_type,
        amount=amount,
        ref_type=ref_type,
        ref_id=ref_id,
        description=description,
        running_balance=running,
        created_by=created_by,
    )
    db.add(entry)
    return entry


async def get_student_ledger(
    db: AsyncSession,
    student_id: str,
    limit: int = 50,
    offset: int = 0,
) -> list:
    from app.modules.fees.models import StudentLedgerEntry

    result = await db.execute(
        select(StudentLedgerEntry)
        .where(StudentLedgerEntry.student_id == student_id)
        .order_by(StudentLedgerEntry.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return result.scalars().all()


async def get_ledger_summary(db: AsyncSession, student_id: str) -> dict:
    from app.modules.fees.models import StudentLedgerEntry

    paid_result = await db.execute(
        select(func.coalesce(func.sum(StudentLedgerEntry.amount), 0))
        .where(
            StudentLedgerEntry.student_id == student_id,
            StudentLedgerEntry.entry_type == "PAYMENT",
        )
    )
    total_paid = paid_result.scalar() or Decimal("0")

    last_result = await db.execute(
        select(func.max(StudentLedgerEntry.created_at))
        .where(StudentLedgerEntry.student_id == student_id)
    )
    last_entry = last_result.scalar()

    year = await get_current_academic_year(db)
    total_due = Decimal("0")
    if year:
        total_due = await get_student_owed_amount(student_id, str(year.id), db)

    return {
        "student_id": student_id,
        "total_due": total_due,
        "total_paid": total_paid,
        "balance": total_due - total_paid,
        "last_entry_date": last_entry,
    }


async def create_journal_entry(
    db: AsyncSession,
    student_id: str,
    description: str,
    debit_amount: Decimal = Decimal("0"),
    credit_amount: Decimal = Decimal("0"),
    created_by: str | None = None,
) -> object:
    from app.modules.fees.models import JournalEntry

    entry = JournalEntry(
        student_id=student_id,
        description=description,
        debit_amount=debit_amount,
        credit_amount=credit_amount,
        status="PENDING",
    )
    db.add(entry)
    await db.flush()
    return entry


async def approve_journal_entry(
    db: AsyncSession,
    entry_id: str,
    status: str,
    approved_by: str,
) -> object:
    from app.modules.fees.models import JournalEntry

    entry = await db.get(JournalEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Journal entry not found")
    if entry.status != "PENDING":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Entry already processed")

    entry.status = status
    entry.approved_by = approved_by

    if status == "APPROVED":
        if entry.debit_amount > 0:
            await post_to_ledger(
                db,
                student_id=str(entry.student_id),
                entry_type="ADJUSTMENT_DEBIT",
                amount=entry.debit_amount,
                ref_type="JournalEntry",
                ref_id=str(entry.id),
                description=entry.description,
                created_by=approved_by,
            )
        if entry.credit_amount > 0:
            await post_to_ledger(
                db,
                student_id=str(entry.student_id),
                entry_type="ADJUSTMENT_CREDIT",
                amount=entry.credit_amount,
                ref_type="JournalEntry",
                ref_id=str(entry.id),
                description=entry.description,
                created_by=approved_by,
            )

    await db.flush()
    return entry


async def get_class_summary(
    db: AsyncSession,
    academic_year_id: str | None = None,
) -> list[dict]:
    """
    Returns, for every class, its sections nested inside, with student
    count and fee totals per section for the given academic year.
    Owed/paid totals are computed per student via get_student_fee_summary
    rather than joined from an Invoice table, since that no longer exists.
    Excludes soft-deleted / inactive users from counts and totals.
    """
    from app.modules.academic.models import AcademicYear as AY, Class, Enrollment, Section
    from app.modules.auth.models import StudentProfile, User

    if not academic_year_id:
        ay = await db.execute(select(AY.id).where(AY.is_active.is_(True)))
        academic_year_id = ay.scalar_one_or_none()

    sections_result = await db.execute(
        select(Class.id, Class.name, Class.order, Section.id.label("section_id"), Section.name.label("section_name"))
        .select_from(Class)
        .join(Section, Section.class_id == Class.id)
        .order_by(Class.order, Section.name)
    )
    section_rows = sections_result.all()

    classes: dict[str, dict] = {}
    for row in section_rows:
        cid = str(row.id)
        if cid not in classes:
            classes[cid] = {"class_id": cid, "class_name": row.name, "sections": []}

        students_result = await db.execute(
            select(StudentProfile.id)
            .join(User, User.id == StudentProfile.user_id)
            .join(Enrollment, (Enrollment.student_id == StudentProfile.id) & (Enrollment.status == "ACTIVE"))
            .where(
                Enrollment.section_id == row.section_id,
                User.deleted_at.is_(None),
                User.is_active.is_(True),
            )
        )
        student_ids = [str(r[0]) for r in students_result.all()]

        total_billed = Decimal("0")
        total_collected = Decimal("0")
        if academic_year_id:
            for sid in student_ids:
                summary = await get_student_fee_summary(sid, str(academic_year_id), db)
                total_billed += summary["owed"]
                total_collected += summary["paid"]

        classes[cid]["sections"].append({
            "section_id": str(row.section_id),
            "section_name": row.section_name,
            "student_count": len(student_ids),
            "total_billed": total_billed,
            "total_collected": total_collected,
            "total_outstanding": total_billed - total_collected,
        })

    return list(classes.values())