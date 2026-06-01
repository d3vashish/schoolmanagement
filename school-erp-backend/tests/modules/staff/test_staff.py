import pytest
from httpx import AsyncClient
from sqlalchemy import select, func

from app.modules.staff.models import PayrollRecord, PayrollRun


@pytest.mark.asyncio
async def test_payroll_idempotent_run(client: AsyncClient, db_session):
    from tests.factories import (
        create_academic_year,
        create_user,
    )

    teacher = await create_user(db_session, role="teacher")
    accountant = await create_user(db_session, role="super_admin")

    from app.core.security import create_access_token
    admin_token = create_access_token(str(accountant.id), "super_admin")

    run1_resp = await client.post(
        "/staff/payroll/run/2099/12",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert run1_resp.status_code == 200

    run2_resp = await client.post(
        "/staff/payroll/run/2099/12",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert run2_resp.status_code == 200

    count = await db_session.execute(
        select(func.count(PayrollRecord.id)).where(PayrollRecord.run_id == "2099-12")
    )
    assert count.scalar() >= 1


@pytest.mark.asyncio
async def test_finalize_payroll(client: AsyncClient, db_session):
    from tests.factories import (
        create_user,
        create_payroll_run,
        create_payroll_record,
    )

    staff = await create_user(db_session, role="teacher")
    admin = await create_user(db_session, role="super_admin")
    run = await create_payroll_run(db_session, year=2026, month=6)
    await create_payroll_record(db_session, run.run_id, staff.id)

    from app.core.security import create_access_token
    admin_token = create_access_token(str(admin.id), "super_admin")

    resp = await client.post(
        f"/staff/payroll/finalize/{run.run_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200

    run_check = await db_session.get(PayrollRun, run.id)
    assert run_check.is_finalized is True
