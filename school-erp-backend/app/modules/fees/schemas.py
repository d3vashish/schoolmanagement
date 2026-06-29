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
    is_new_student: bool = False


class FeeStructureResponse(BaseModel):
    id: UUID
    academic_year_id: UUID
    class_id: UUID
    class_name: str | None = None
    fee_head_id: UUID
    fee_head_name: str | None = None
    amount: Decimal
    is_new_student: bool

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


class FeeReceiptCreate(BaseModel):
    student_id: UUID
    academic_year_id: UUID
    amount: Decimal
    mode: str
    reference_no: str | None = None
    notes: str | None = None


class FeeReceiptResponse(BaseModel):
    id: UUID
    receipt_number: str
    student_id: UUID
    academic_year_id: UUID
    amount: Decimal
    mode: str
    reference_no: str | None
    notes: str | None
    received_by: UUID
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class StudentFeeSummaryResponse(BaseModel):
    student_id: UUID
    academic_year_id: UUID
    owed: Decimal
    paid: Decimal
    remaining: Decimal
    status: str


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


class SectionSummaryResponse(BaseModel):
    section_id: str
    section_name: str
    student_count: int
    total_billed: Decimal
    total_collected: Decimal
    total_outstanding: Decimal


class ClassSummaryResponse(BaseModel):
    class_id: str
    class_name: str
    sections: list[SectionSummaryResponse]