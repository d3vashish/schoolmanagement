from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, role_required
from app.modules.staff.models import (
    PayrollRecord,
    PayrollRun,
    SalarySlip,
    StaffLeave,
)
from app.modules.staff.schemas import (
    PayrollRecordResponse,
    PayrollRunResponse,
    StaffLeaveCreate,
    StaffLeaveResponse,
)
from app.modules.staff.payroll import finalize_payroll

admin_only = [role_required("super_admin", "principal")]
teacher_admin = [role_required("super_admin", "principal", "teacher")]

all_auth = [Depends(get_current_user)]

router = APIRouter(prefix="/staff", tags=["staff"])


@router.post("/leaves", response_model=StaffLeaveResponse)
async def apply_leave(
    body: StaffLeaveCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    leave = StaffLeave(
        staff_id=current_user["id"],
        **body.model_dump(),
    )
    db.add(leave)
    await db.flush()
    return leave


@router.get("/leaves", response_model=list[StaffLeaveResponse], dependencies=all_auth)
async def list_leaves(staff_id: str | None = None, db: AsyncSession = Depends(get_db)):
    q = select(StaffLeave).order_by(StaffLeave.start_date.desc())
    if staff_id:
        q = q.where(StaffLeave.staff_id == staff_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.patch("/leaves/{leave_id}/approve", dependencies=admin_only)
async def approve_leave(
    leave_id: str,
    action: str = Query(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    leave = await db.get(StaffLeave, leave_id)
    if not leave:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    leave.status = action.upper()
    leave.approved_by = current_user["id"]
    await db.flush()
    return {"ok": True}


@router.post("/payroll/run/{year}/{month}", dependencies=admin_only)
async def run_payroll(year: int, month: int, db: AsyncSession = Depends(get_db)):
    from app.modules.staff.payroll import run_payroll_for_month
    result = await run_payroll_for_month(year, month, db)
    return result


@router.post("/payroll/finalize/{run_id}", dependencies=admin_only)
async def finalize(
    run_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    run = await finalize_payroll(run_id, current_user["id"], db)
    return {"ok": True, "run_id": run.run_id}


@router.get("/payroll/runs", response_model=list[PayrollRunResponse], dependencies=admin_only)
async def list_runs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PayrollRun).order_by(PayrollRun.created_at.desc()))
    return result.scalars().all()


@router.get("/payroll/records", response_model=list[PayrollRecordResponse], dependencies=admin_only)
async def list_records(run_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PayrollRecord).where(PayrollRecord.run_id == run_id)
    )
    return result.scalars().all()


@router.get("/salary-slips", dependencies=admin_only)
async def list_salary_slips(staff_id: str | None = None, db: AsyncSession = Depends(get_db)):
    q = select(SalarySlip).order_by(SalarySlip.created_at.desc())
    if staff_id:
        q = q.where(SalarySlip.staff_id == staff_id)
    result = await db.execute(q)
    slips = result.scalars().all()
    return [
        {
            "name": str(s.id),
            "staff_id": str(s.staff_id),
            "start_date": str(s.generated_at) if s.generated_at else None,
            "end_date": str(s.generated_at) if s.generated_at else None,
            "net_pay": 0,
            "status": "Generated",
            "gross_pay": 0,
        }
        for s in slips
    ]
