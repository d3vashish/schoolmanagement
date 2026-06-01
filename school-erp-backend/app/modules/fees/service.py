from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
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
