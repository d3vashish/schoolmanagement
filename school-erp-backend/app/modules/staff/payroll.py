from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.academic.utils import is_working_day
from app.modules.staff.models import PayrollRecord, PayrollRun, StaffLeave


async def get_staff_monthly_gross(staff_id: str, db: AsyncSession) -> Decimal:
    from app.modules.auth.models import StaffProfile
    result = await db.execute(
        select(StaffProfile).where(StaffProfile.user_id == staff_id)
    )
    profile = result.scalar_one_or_none()
    return Decimal("30000")


async def count_lop_days(staff_id: str, year: int, month: int, db: AsyncSession) -> int:
    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1)
    else:
        end = date(year, month + 1, 1)
    from datetime import timedelta
    end -= timedelta(days=1)

    result = await db.execute(
        select(func.coalesce(func.sum(
            func.date(StaffLeave.end_date) - func.date(StaffLeave.start_date) + 1
        ), 0)).where(
            StaffLeave.staff_id == staff_id,
            StaffLeave.status == "APPROVED",
            StaffLeave.start_date >= start,
            StaffLeave.end_date <= end,
        )
    )
    total_leaves = result.scalar() or 0
    entitled = 2
    return max(0, total_leaves - entitled)


async def count_working_days_in_month(year: int, month: int, db: AsyncSession) -> int:
    from datetime import date, timedelta
    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1)
    else:
        end = date(year, month + 1, 1)
    end -= timedelta(days=1)

    total = 0
    d = start
    while d <= end:
        if await is_working_day(d, db):
            total += 1
        d += timedelta(days=1)
    return total


async def run_payroll_for_month(year: int, month: int, db: AsyncSession) -> dict:
    run_id = f"{year}-{month:02d}"
    existing_run = await db.execute(
        select(PayrollRun).where(PayrollRun.run_id == run_id)
    )
    payroll_run = existing_run.scalar_one_or_none()
    if not payroll_run:
        payroll_run = PayrollRun(run_id=run_id, year=year, month=month)
        db.add(payroll_run)
        await db.flush()

    from app.modules.auth.models import User
    staff_result = await db.execute(
        select(User).where(User.role.in_(["teacher", "principal", "accountant", "librarian"]), User.is_active.is_(True))
    )
    staff_list = staff_result.scalars().all()

    working_days = await count_working_days_in_month(year, month, db)
    if working_days == 0:
        working_days = 1

    for staff in staff_list:
        gross = await get_staff_monthly_gross(str(staff.id), db)
        lop_days = 0
        lop_deduction = Decimal("0")
        pf_employee = gross * Decimal("0.12")
        pf_employer = gross * Decimal("0.12")
        esic = gross * Decimal("0.0075")
        net_pay = gross - lop_deduction - pf_employee - esic

        stmt = (
            insert(PayrollRecord)
            .values(
                run_id=run_id,
                staff_id=staff.id,
                monthly_gross=gross,
                lop_days=lop_days,
                lop_deduction=lop_deduction,
                pf_employee=pf_employee,
                pf_employer=pf_employer,
                esic=esic,
                net_pay=net_pay,
            )
            .on_conflict_do_update(
                index_elements=["run_id", "staff_id"],
                set_={
                    "net_pay": net_pay,
                    "pf_employee": pf_employee,
                    "esic": esic,
                    "lop_days": lop_days,
                    "is_draft": True,
                },
            )
        )
        await db.execute(stmt)

    return {"run_id": run_id, "staff_count": len(staff_list)}


async def finalize_payroll(run_id: str, finalized_by: str, db: AsyncSession) -> PayrollRun:
    payroll_run = await db.execute(
        select(PayrollRun).where(PayrollRun.run_id == run_id)
    )
    run = payroll_run.scalar_one_or_none()
    if not run:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    run.is_finalized = True
    run.finalized_by = finalized_by
    run.finalized_at = date.today()

    await db.execute(
        PayrollRecord.__table__.update()
        .where(PayrollRecord.run_id == run_id)
        .values(is_draft=False)
    )
    await db.flush()
    return run
