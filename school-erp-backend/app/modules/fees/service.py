from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.academic.models import AcademicYear
from app.modules.fees.models import (
    FeeInstallment,
    FeeStructure,
    Invoice,
    LateFeeRule,
    StudentDiscount,
)
from app.modules.fees.utils import calculate_late_fee


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


async def get_student_discounts(student_id: str, db: AsyncSession) -> list[StudentDiscount]:
    result = await db.execute(
        select(StudentDiscount).where(StudentDiscount.student_id == student_id)
    )
    return result.scalars().all()


def calculate_gross(installment: FeeStructure, amount: Decimal) -> Decimal:
    return amount * Decimal(installment.percent) / Decimal(100)


def apply_discounts(gross: Decimal, discounts: list[StudentDiscount]) -> Decimal:
    total = Decimal("0")
    for d in discounts:
        if d.percentage:
            total += gross * d.percentage / Decimal(100)
        elif d.flat_amount:
            total += d.flat_amount
    return min(total, gross)


async def generate_invoices(student_id: str, db: AsyncSession) -> list[Invoice]:
    from app.modules.auth.models import StudentProfile

    student_result = await db.execute(
        select(StudentProfile).where(StudentProfile.id == student_id)
    )
    student = student_result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    year = await get_current_academic_year(db)
    if not year:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active academic year")

    structures = await get_fee_structure(str(student.class_id), str(year.id), db)
    if not structures:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fee structure for this class")

    discounts = await get_student_discounts(student_id, db)
    invoices = []

    for structure in structures:
        installment_result = await db.execute(
            select(FeeInstallment).where(FeeInstallment.structure_id == structure.id)
            .order_by(FeeInstallment.due_date)
        )
        installments = installment_result.scalars().all()

        for installment in installments:
            gross = structure.amount * Decimal(installment.percent) / Decimal(100)
            discount = apply_discounts(gross, discounts)
            net = gross - discount

            late_fee_result = await db.execute(
                select(LateFeeRule).where(LateFeeRule.structure_id == structure.id)
            )
            late_fee_rule = late_fee_result.scalar_one_or_none()

            invoice = Invoice(
                student_id=student_id,
                installment_id=installment.id,
                gross_amount=gross,
                discount_amount=discount,
                net_amount=net,
                due_date=installment.due_date,
                status="PENDING",
                late_fee_per_day=late_fee_rule.amount_per_day if late_fee_rule else Decimal("0"),
                late_fee_max=late_fee_rule.max_amount if late_fee_rule else None,
            )
            db.add(invoice)
            invoices.append(invoice)

    await db.flush()
    return invoices


def get_invoice_total_with_late_fee(invoice: Invoice) -> Decimal:
    return invoice.net_amount + calculate_late_fee(invoice)


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


async def record_payment(
    db: AsyncSession,
    invoice_id: str,
    amount: Decimal,
    mode: str,
    reference_no: str | None,
    received_by: str,
    notes: str | None,
) -> dict:
    from app.modules.fees.models import Invoice, Payment

    invoice = await db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    if invoice.status == "PAID":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invoice already paid")

    payment = Payment(
        invoice_id=invoice_id,
        amount=amount,
        mode=mode,
        reference_no=reference_no,
        received_by=received_by,
        notes=notes,
    )
    db.add(payment)

    invoice.paid_amount = (invoice.paid_amount or Decimal("0")) + amount
    if invoice.paid_amount >= invoice.net_amount:
        invoice.status = "PAID"
        from datetime import datetime, timezone
        invoice.paid_at = datetime.now(timezone.utc)

    await post_to_ledger(
        db,
        student_id=str(invoice.student_id),
        entry_type="PAYMENT",
        amount=amount,
        ref_type="Payment",
        ref_id=None,
        description=f"Payment for invoice {str(invoice_id)[:8]} - {mode}",
        created_by=received_by,
    )

    await db.flush()
    return {"payment_id": str(payment.id), "invoice_status": invoice.status}


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
    from app.modules.fees.models import Invoice, StudentLedgerEntry

    due_result = await db.execute(
        select(func.coalesce(func.sum(Invoice.net_amount), 0))
        .where(Invoice.student_id == student_id, Invoice.status != "PAID")
    )
    total_due = due_result.scalar() or Decimal("0")

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

    return {
        "student_id": student_id,
        "total_due": total_due,
        "total_paid": total_paid,
        "balance": total_due - total_paid,
        "last_entry_date": last_entry,
    }


async def get_defaulters(
    db: AsyncSession,
    academic_year_id: str | None = None,
    section_id: str | None = None,
) -> list[dict]:
    from app.modules.academic.models import AcademicYear, Enrollment, Section
    from app.modules.auth.models import StudentProfile, User

    from sqlalchemy import and_, or_

    q = select(
        StudentProfile.id,
        User.full_name,
        Section.name.label("section_name"),
        func.coalesce(func.sum(Invoice.net_amount), 0).label("total_due"),
        func.coalesce(func.sum(Invoice.paid_amount), 0).label("total_paid"),
        func.count(Invoice.id).label("overdue_count"),
    ).select_from(StudentProfile)

    q = q.join(User, User.id == StudentProfile.user_id)
    q = q.join(Enrollment, and_(
        Enrollment.student_id == StudentProfile.id,
        Enrollment.status == "ACTIVE",
    ))
    q = q.join(Section, Section.id == Enrollment.section_id)
    q = q.join(Invoice, and_(
        Invoice.student_id == StudentProfile.id,
        Invoice.status != "PAID",
        Invoice.due_date < func.current_date(),
    ))

    if academic_year_id:
        q = q.where(Invoice.academic_year_id == academic_year_id)
    else:
        ay = await db.execute(
            select(AcademicYear.id).where(AcademicYear.is_active.is_(True))
        )
        ay_id = ay.scalar_one_or_none()
        if ay_id:
            q = q.where(Invoice.academic_year_id == ay_id)

    if section_id:
        q = q.where(Enrollment.section_id == section_id)

    q = q.group_by(StudentProfile.id, User.full_name, Section.name)
    q = q.order_by((func.coalesce(func.sum(Invoice.net_amount), 0) - func.coalesce(func.sum(Invoice.paid_amount), 0)).desc())

    result = await db.execute(q)
    rows = result.all()

    return [
        {
            "student_id": str(row.id),
            "student_name": row.full_name,
            "section": row.section_name,
            "total_due": row.total_due,
            "total_paid": row.total_paid,
            "balance": row.total_due - row.total_paid,
            "overdue_count": row.overdue_count,
        }
        for row in rows
    ]


async def get_collection_report(
    db: AsyncSession,
    from_date: str | None = None,
    to_date: str | None = None,
) -> list[dict]:
    from app.modules.fees.models import Payment

    from datetime import date

    today = date.today()

    q = select(
        func.date(Payment.created_at).label("payment_date"),
        func.coalesce(func.sum(Payment.amount), 0).label("total_collected"),
        func.count(Payment.id).label("payment_count"),
    )

    if from_date:
        q = q.where(func.date(Payment.created_at) >= from_date)
    if to_date:
        q = q.where(func.date(Payment.created_at) <= to_date)

    q = q.group_by(func.date(Payment.created_at))
    q = q.order_by(func.date(Payment.created_at).desc())

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
