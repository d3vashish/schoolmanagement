from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class PayrollRunResponse(BaseModel):
    id: UUID
    run_id: str
    year: int
    month: int
    is_finalized: bool

    model_config = {"from_attributes": True}


class PayrollRecordResponse(BaseModel):
    id: UUID
    run_id: str
    staff_id: UUID
    monthly_gross: Decimal
    lop_days: int
    lop_deduction: Decimal
    pf_employee: Decimal
    pf_employer: Decimal
    esic: Decimal
    net_pay: Decimal
    is_draft: bool

    model_config = {"from_attributes": True}


class StaffLeaveCreate(BaseModel):
    leave_type: str
    start_date: str
    end_date: str
    reason: str | None = None


class StaffLeaveResponse(BaseModel):
    id: UUID
    staff_id: UUID
    leave_type: str
    start_date: str
    end_date: str
    reason: str | None
    status: str

    model_config = {"from_attributes": True}
