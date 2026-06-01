from datetime import date
from unittest.mock import patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.modules.fees.models import Invoice


@pytest.mark.asyncio
async def test_late_fee_calculation(client: AsyncClient, db_session):
    from tests.factories import (
        create_academic_year,
        create_class,
        create_student_profile,
        create_fee_structure,
        create_invoice,
    )
    ay = await create_academic_year(db_session)
    cls = await create_class(db_session, ay.id)
    student = await create_student_profile(db_session)
    _, _, installment = await create_fee_structure(db_session, cls.id, ay.id)

    inv = await create_invoice(
        db_session,
        student_id=student.id,
        installment_id=installment.id,
        amount=10000,
        due_date=date(2024, 1, 1),
    )

    from app.modules.fees.utils import calculate_late_fee
    fee = calculate_late_fee(inv)

    days_overdue = (date.today() - date(2024, 1, 1)).days
    expected_raw = 5 * days_overdue
    expected = min(expected_raw, 500)
    assert fee == expected, f"Expected {expected}, got {fee}"

    inv.status = "PAID"
    await db_session.flush()
    paid_fee = calculate_late_fee(inv)
    assert paid_fee == 0


@pytest.mark.asyncio
async def test_razorpay_webhook_idempotent(client: AsyncClient, db_session):
    from tests.factories import (
        create_academic_year,
        create_class,
        create_student_profile,
        create_fee_structure,
        create_invoice,
    )
    ay = await create_academic_year(db_session)
    cls = await create_class(db_session, ay.id)
    student = await create_student_profile(db_session)
    _, _, installment = await create_fee_structure(db_session, cls.id, ay.id)

    inv = await create_invoice(
        db_session,
        student_id=student.id,
        installment_id=installment.id,
        amount=5000,
        due_date=date(2026, 6, 1),
    )

    from app.modules.fees.models import PaymentOrder
    po = PaymentOrder(invoice_id=inv.id, razorpay_order_id="order_test_idempotent", amount=5000)
    db_session.add(po)
    await db_session.flush()

    payload = {
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_test_idempotent",
                    "order_id": "order_test_idempotent",
                    "amount": 500000,
                }
            }
        },
    }

    with patch("app.modules.fees.router.verify_webhook_signature", return_value=True):
        webhook_resp = await client.post(
            "/fees/webhook/razorpay",
            json=payload,
            headers={"X-Razorpay-Signature": "test_sig"},
        )
        assert webhook_resp.status_code == 200

        webhook_resp2 = await client.post(
            "/fees/webhook/razorpay",
            json=payload,
            headers={"X-Razorpay-Signature": "test_sig"},
        )
        assert webhook_resp2.status_code == 200
