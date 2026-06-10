from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class FeeHeadCreate(BaseModel):
    name: str
    is_taxable: bool = False
    tax_percent: Decimal = Decimal("0")


class FeeHeadResponse(BaseModel):
    id: UUID
    name: str
    is_taxable: bool
    tax_percent: Decimal

    model_config = {"from_attributes": True}


class FeeStructureCreate(BaseModel):
    academic_year_id: UUID
    class_id: UUID
    fee_head_id: UUID
    amount: Decimal


class FeeStructureResponse(BaseModel):
    id: UUID
    academic_year_id: UUID
    class_id: UUID
    fee_head_id: UUID
    amount: Decimal

    model_config = {"from_attributes": True}


class FeeInstallmentCreate(BaseModel):
    structure_id: UUID
    name: str
    due_date: date
    percent: int


class FeeInstallmentResponse(BaseModel):
    id: UUID
    structure_id: UUID
    name: str
    due_date: date
    percent: int

    model_config = {"from_attributes": True}


class StudentDiscountCreate(BaseModel):
    student_id: UUID
    discount_type: str
    percentage: Decimal | None = None
    flat_amount: Decimal | None = None
    valid_until: date | None = None
    reason: str | None = None


class StudentDiscountResponse(BaseModel):
    id: UUID
    student_id: UUID
    discount_type: str
    percentage: Decimal | None
    flat_amount: Decimal | None
    valid_until: date | None
    reason: str | None

    model_config = {"from_attributes": True}


class InvoiceCreate(BaseModel):
    student_id: str
    installment_id: str
    gross_amount: Decimal
    discount_amount: Decimal = Decimal("0")
    net_amount: Decimal
    due_date: date
    section_id: str | None = None
    academic_year_id: str | None = None


class InvoiceResponse(BaseModel):
    id: UUID
    student_id: UUID
    section_id: UUID | None = None
    academic_year_id: UUID | None = None
    installment_id: UUID
    gross_amount: Decimal
    discount_amount: Decimal
    net_amount: Decimal
    due_date: date
    status: str
    paid_at: datetime | None
    late_fee_per_day: Decimal
    razorpay_order_id: str | None
    receipt_url: str | None

    model_config = {"from_attributes": True}


class CreateOrderResponse(BaseModel):
    razorpay_order_id: str
    amount: Decimal
    currency: str = "INR"


class PaymentOrderResponse(BaseModel):
    id: UUID
    invoice_id: UUID
    razorpay_order_id: str
    amount: Decimal
    status: str
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class RazorpayWebhookPayload(BaseModel):
    razorpay_payment_id: str
    razorpay_order_id: str
    status: str


class StudentLedgerEntryResponse(BaseModel):
    id: UUID
    student_id: UUID
    entry_type: str
    amount: Decimal
    ref_type: str
    ref_id: UUID | None
    description: str | None
    running_balance: Decimal
    created_by: UUID | None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class PaymentCreate(BaseModel):
    invoice_id: UUID
    amount: Decimal
    mode: str
    reference_no: str | None = None
    notes: str | None = None


class PaymentResponse(BaseModel):
    id: UUID
    invoice_id: UUID
    amount: Decimal
    mode: str
    reference_no: str | None
    received_by: UUID
    notes: str | None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class JournalEntryCreate(BaseModel):
    student_id: UUID
    description: str
    debit_amount: Decimal = Decimal("0")
    credit_amount: Decimal = Decimal("0")


class JournalEntryResponse(BaseModel):
    id: UUID
    student_id: UUID
    description: str
    debit_amount: Decimal
    credit_amount: Decimal
    approved_by: UUID | None
    status: str
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class JournalEntryApprove(BaseModel):
    status: str


class LedgerSummaryResponse(BaseModel):
    student_id: UUID
    total_due: Decimal
    total_paid: Decimal
    balance: Decimal
    last_entry_date: datetime | None = None


class DefaulterResponse(BaseModel):
    student_id: UUID
    student_name: str
    section: str
    total_due: Decimal
    total_paid: Decimal
    balance: Decimal
    overdue_count: int


class CollectionReportResponse(BaseModel):
    date: date
    total_collected: Decimal
    payment_count: int
    mode_breakdown: dict | None = None
