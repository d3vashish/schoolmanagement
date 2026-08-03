from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import QueryScoper, get_current_user, role_required
from app.modules.fees.models import (
    FeeHead,
    FeeInstallment,
    FeeReceipt,
    FeeStructure,
    JournalEntry,
    StudentDiscount,
    StudentLedgerEntry,
)
from app.modules.fees.schemas import (
    ClassSummaryResponse,
    CollectionReportResponse,
    DefaulterResponse,
    FeeHeadCreate,
    FeeHeadResponse,
    FeeInstallmentCreate,
    FeeInstallmentResponse,
    FeeInstallmentUpdate,
    FeeReceiptCreate,
    FeeReceiptResponse,
    FeeStructureCreate,
    FeeStructureResponse,
    JournalEntryApprove,
    JournalEntryCreate,
    JournalEntryResponse,
    LedgerSummaryResponse,
    StudentDiscountCreate,
    StudentDiscountResponse,
    StudentFeeSummaryResponse,
    StudentLedgerEntryResponse,
)
from app.modules.fees.service import (
    approve_journal_entry,
    create_journal_entry,
    get_class_summary,
    get_collection_report,
    get_defaulters,
    get_ledger_summary,
    get_structures_detailed,
    get_student_fee_summary,
    get_student_ledger,
    get_student_receipts,
    record_fee_payment,
)

admin_only = [role_required("super_admin", "principal", "accountant")]

all_auth = [Depends(get_current_user)]

router = APIRouter(prefix="/fees", tags=["fees"])


@router.get("/heads/{head_id}", response_model=FeeHeadResponse, dependencies=all_auth)
async def get_fee_head(head_id: str, db: AsyncSession = Depends(get_db)):
    head = await db.get(FeeHead, head_id)
    if not head:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fee head not found")
    return head


@router.get("/heads", response_model=list[FeeHeadResponse], dependencies=all_auth)
async def list_fee_heads(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FeeHead).order_by(FeeHead.name))
    return result.scalars().all()


@router.post("/heads", response_model=FeeHeadResponse, dependencies=admin_only)
async def create_fee_head(body: FeeHeadCreate, db: AsyncSession = Depends(get_db)):
    head = FeeHead(**body.model_dump())
    db.add(head)
    await db.flush()
    return head


@router.get("/structures/{structure_id}", response_model=FeeStructureResponse, dependencies=all_auth)
async def get_structure(structure_id: str, db: AsyncSession = Depends(get_db)):
    struct = await db.get(FeeStructure, structure_id)
    if not struct:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fee structure not found")
    return struct


@router.get("/structures", response_model=list[FeeStructureResponse], dependencies=all_auth)
async def list_structures(
    academic_year_id: str | None = None,
    class_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    return await get_structures_detailed(db, academic_year_id, class_id)


@router.post("/structures", response_model=FeeStructureResponse, dependencies=admin_only)
async def create_structure(body: FeeStructureCreate, db: AsyncSession = Depends(get_db)):
    struct = FeeStructure(**body.model_dump())
    db.add(struct)
    await db.flush()
    return struct


@router.post("/structures/{structure_id}/clone", dependencies=admin_only)
async def clone_structure(structure_id: str, target_academic_year_id: str, db: AsyncSession = Depends(get_db)):
    original = await db.get(FeeStructure, structure_id)
    if not original:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    new_struct = FeeStructure(
        academic_year_id=target_academic_year_id,
        class_id=original.class_id,
        fee_head_id=original.fee_head_id,
        amount=original.amount,
        is_new_student=original.is_new_student,
    )
    db.add(new_struct)
    await db.flush()
    return {"ok": True, "new_structure_id": str(new_struct.id)}


@router.patch("/structures/{structure_id}", response_model=FeeStructureResponse, dependencies=admin_only)
async def update_structure(structure_id: str, body: FeeStructureCreate, db: AsyncSession = Depends(get_db)):
    struct = await db.get(FeeStructure, structure_id)
    if not struct:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    struct.academic_year_id = body.academic_year_id
    struct.class_id = body.class_id
    struct.fee_head_id = body.fee_head_id
    struct.amount = body.amount
    struct.is_new_student = body.is_new_student
    await db.flush()
    return struct


@router.delete("/structures/{structure_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=admin_only)
async def delete_structure(structure_id: str, db: AsyncSession = Depends(get_db)):
    struct = await db.get(FeeStructure, structure_id)
    if not struct:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)


# ── Fee Installments ─────────────────────────────────────────────────────────
# One structure (e.g. "1st Standard / Old Student / School Fee") is split into
# installments — Term 1, Term 2, etc — each covering a percent of the total.
# The structure-create UI requires these to add up to 100%; enforcing that
# is left to the frontend, same as it already validates required fields there.

@router.get(
    "/structures/{structure_id}/installments",
    response_model=list[FeeInstallmentResponse],
    dependencies=all_auth,
)
async def list_installments(structure_id: str, db: AsyncSession = Depends(get_db)):
    struct = await db.get(FeeStructure, structure_id)
    if not struct:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fee structure not found")
    result = await db.execute(
        select(FeeInstallment)
        .where(FeeInstallment.structure_id == structure_id)
        .order_by(FeeInstallment.due_date)
    )
    return result.scalars().all()


@router.post("/installments", response_model=FeeInstallmentResponse, dependencies=admin_only)
async def create_installment(body: FeeInstallmentCreate, db: AsyncSession = Depends(get_db)):
    struct = await db.get(FeeStructure, body.structure_id)
    if not struct:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fee structure not found")
    installment = FeeInstallment(**body.model_dump())
    db.add(installment)
    await db.flush()
    return installment


@router.patch("/installments/{installment_id}", response_model=FeeInstallmentResponse, dependencies=admin_only)
async def update_installment(installment_id: str, body: FeeInstallmentUpdate, db: AsyncSession = Depends(get_db)):
    installment = await db.get(FeeInstallment, installment_id)
    if not installment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Installment not found")
    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(installment, field, value)
    await db.flush()
    return installment


@router.delete("/installments/{installment_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=admin_only)
async def delete_installment(installment_id: str, db: AsyncSession = Depends(get_db)):
    installment = await db.get(FeeInstallment, installment_id)
    if not installment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Installment not found")
    await db.delete(installment)
    await db.flush()
    await db.delete(struct)


@router.get("/discounts", response_model=list[StudentDiscountResponse], dependencies=all_auth)
async def list_discounts(student_id: str | None = None, db: AsyncSession = Depends(get_db)):
    q = select(StudentDiscount)
    if student_id:
        q = q.where(StudentDiscount.student_id == student_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/discounts", response_model=StudentDiscountResponse, dependencies=admin_only)
async def create_discount(body: StudentDiscountCreate, db: AsyncSession = Depends(get_db)):
    discount = StudentDiscount(**body.model_dump())
    db.add(discount)
    await db.flush()
    return discount


# ── Fee Receipts (replaces Invoices/Payments) ─────────────────────────────

@router.post("/receipts", response_model=FeeReceiptResponse, dependencies=admin_only)
async def create_receipt(
    body: FeeReceiptCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    receipt = await record_fee_payment(
        db,
        student_id=str(body.student_id),
        academic_year_id=str(body.academic_year_id),
        amount=body.amount,
        mode=body.mode,
        reference_no=body.reference_no,
        received_by=current_user["id"],
        notes=body.notes,
    )
    return receipt


@router.get("/receipts", response_model=list[FeeReceiptResponse])
async def list_receipts(
    student_id: str | None = None,
    academic_year_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if student_id:
        return await get_student_receipts(db, student_id, academic_year_id)
    q = select(FeeReceipt).order_by(FeeReceipt.created_at.desc())
    if academic_year_id:
        q = q.where(FeeReceipt.academic_year_id == academic_year_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/receipts/{receipt_id}", response_model=FeeReceiptResponse, dependencies=all_auth)
async def get_receipt(receipt_id: str, db: AsyncSession = Depends(get_db)):
    receipt = await db.get(FeeReceipt, receipt_id)
    if not receipt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receipt not found")
    return receipt


@router.get("/students/{student_id}/summary", response_model=StudentFeeSummaryResponse, dependencies=all_auth)
async def student_fee_summary(
    student_id: str,
    academic_year_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    if not academic_year_id:
        from app.modules.fees.service import get_current_academic_year
        year = await get_current_academic_year(db)
        if not year:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active academic year")
        academic_year_id = str(year.id)
    summary = await get_student_fee_summary(student_id, academic_year_id, db)
    return summary


@router.get("/payment-modes")
async def list_payment_modes():
    return [
        {"name": "Cash", "mode_of_payment": "Cash"},
        {"name": "Bank Transfer", "mode_of_payment": "Bank Transfer"},
        {"name": "Cheque", "mode_of_payment": "Cheque"},
        {"name": "Online Payment", "mode_of_payment": "Online Payment"},
        {"name": "Card", "mode_of_payment": "Card"},
    ]


@router.get("/accounts", dependencies=all_auth)
async def list_accounts():
    return []


@router.post("/accounts", dependencies=admin_only)
async def create_account(data: dict):
    return {"name": f"ACC-{datetime.now().timestamp()}", **data}


# DISCONNECTED (2026-06-25): Razorpay webhook was built around Invoice/PaymentOrder,
# which have been removed in favor of the receipt-based fee model. See
# fees/razorpay.py for details on re-enabling this later.
#
# @router.post("/webhook/razorpay")
# async def razorpay_webhook(request: Request, db: AsyncSession = Depends(get_db)):
#     body = await request.body()
#     signature = request.headers.get("x-razorpay-signature", "")
#     if not verify_webhook_signature(body, signature):
#         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature")
#     payload = await request.json()
#     return await handle_payment_webhook(payload, db)


@router.get("/ledger/{student_id}", response_model=list[StudentLedgerEntryResponse])
async def list_ledger_entries(
    student_id: str,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    entries = await get_student_ledger(db, student_id, limit, offset)
    return entries


@router.get("/ledger/{student_id}/summary", response_model=LedgerSummaryResponse)
async def student_ledger_summary(
    student_id: str,
    academic_year_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    summary = await get_ledger_summary(db, student_id, academic_year_id)
    return summary


@router.post("/journal-entries", response_model=JournalEntryResponse, dependencies=admin_only)
async def create_journal_entry_endpoint(
    body: JournalEntryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    entry = await create_journal_entry(
        db,
        student_id=str(body.student_id),
        description=body.description,
        debit_amount=body.debit_amount,
        credit_amount=body.credit_amount,
    )
    return entry


@router.get("/journal-entries", response_model=list[JournalEntryResponse])
async def list_journal_entries(
    student_id: str | None = None,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    q = select(JournalEntry).order_by(JournalEntry.created_at.desc())
    if student_id:
        q = q.where(JournalEntry.student_id == student_id)
    if status:
        q = q.where(JournalEntry.status == status)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/journal-entries/{entry_id}/approve", response_model=JournalEntryResponse, dependencies=admin_only)
async def approve_journal_entry_endpoint(
    entry_id: str,
    body: JournalEntryApprove,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    entry = await approve_journal_entry(
        db, entry_id, body.status, approved_by=current_user["id"]
    )
    return entry


@router.get("/reports/defaulters", response_model=list[DefaulterResponse])
async def defaulter_report(
    academic_year_id: str | None = None,
    section_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    defaulters = await get_defaulters(db, academic_year_id, section_id)
    return defaulters


@router.get("/reports/collections", response_model=list[CollectionReportResponse])
async def collection_report(
    from_date: str | None = None,
    to_date: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    report = await get_collection_report(db, from_date, to_date)
    return report


@router.get("/reports/class-summary", response_model=list[ClassSummaryResponse], dependencies=admin_only)
async def class_summary_report(
    academic_year_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Class-wise, section-wise breakdown of student counts and fee totals.
    Defaults to the currently active academic year if none is given.
    """
    summary = await get_class_summary(db, academic_year_id)
    return summary