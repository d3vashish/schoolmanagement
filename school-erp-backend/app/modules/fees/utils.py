from datetime import date
from decimal import Decimal

from app.modules.fees.models import Invoice


def calculate_late_fee(invoice: Invoice) -> Decimal:
    if invoice.status == "PAID":
        return Decimal("0")
    today = date.today()
    if today <= invoice.due_date:
        return Decimal("0")
    overdue_days = (today - invoice.due_date).days
    raw = invoice.late_fee_per_day * overdue_days
    if invoice.late_fee_max is not None:
        return min(raw, invoice.late_fee_max)
    return raw
