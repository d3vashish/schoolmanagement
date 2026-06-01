import hashlib
import hmac
import json
from datetime import datetime, timezone
from decimal import Decimal

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.modules.fees.models import Invoice, PaymentOrder

RAZORPAY_AUTH = (settings.RAZORPAY_KEY_ID, settings.RAZORPAY_SECRET)
RAZORPAY_API = "https://api.razorpay.com/v1"


def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    expected = hmac.new(
        settings.RAZORPAY_SECRET.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


async def create_razorpay_order(amount: Decimal, receipt: str) -> dict:
    payload = {
        "amount": int(amount * 100),
        "currency": "INR",
        "receipt": receipt,
        "payment_capture": 1,
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{RAZORPAY_API}/orders",
            json=payload,
            auth=RAZORPAY_AUTH,
        )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to create Razorpay order",
        )
    return resp.json()


async def handle_payment_webhook(payload: dict, db: AsyncSession) -> dict:
    payment_id = payload.get("payload", {}).get("payment", {}).get("entity", {}).get("id")
    order_id = payload.get("payload", {}).get("payment", {}).get("entity", {}).get("order_id")
    event = payload.get("event", "")

    if event != "payment.captured":
        return {"status": "ignored"}

    if not payment_id or not order_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing payment details")

    existing = await db.execute(
        select(Invoice).where(Invoice.razorpay_payment_id == payment_id)
    )
    if existing.scalar_one_or_none():
        return {"status": "already_processed"}

    order_result = await db.execute(
        select(PaymentOrder).where(PaymentOrder.razorpay_order_id == order_id)
    )
    payment_order = order_result.scalar_one_or_none()
    if not payment_order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    invoice = await db.get(Invoice, payment_order.invoice_id)
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    invoice.status = "PAID"
    invoice.paid_at = datetime.now(timezone.utc)
    invoice.razorpay_payment_id = payment_id
    payment_order.status = "PAID"
    await db.flush()

    return {"status": "success", "invoice_id": str(invoice.id)}
