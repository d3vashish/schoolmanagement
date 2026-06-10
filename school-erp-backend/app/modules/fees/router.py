from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import QueryScoper, get_current_user, role_required
from app.modules.fees.models import (
    FeeHead,
    FeeInstallment,
    FeeStructure,
    Invoice,
    JournalEntry,
    LateFeeRule,
    Payment,
    PaymentOrder,
    StudentDiscount,
    StudentLedgerEntry,
)
from app.modules.fees.razorpay import (
    create_razorpay_order,
    handle_payment_webhook,
    verify_webhook_signature,
)
from app.modules.fees.schemas import (
    CollectionReportResponse,
    CreateOrderResponse,
    DefaulterResponse,
    FeeHeadCreate,
    FeeHeadResponse,
    FeeInstallmentCreate,
    FeeInstallmentResponse,
    FeeStructureCreate,
    FeeStructureResponse,
    InvoiceCreate,
    InvoiceResponse,
    JournalEntryApprove,
    JournalEntryCreate,
    JournalEntryResponse,
    LedgerSummaryResponse,
    PaymentCreate,
    PaymentOrderResponse,
    PaymentResponse,
    StudentDiscountCreate,
    StudentDiscountResponse,
    StudentLedgerEntryResponse,
)
from app.modules.fees.service import (
    approve_journal_entry,
    create_journal_entry,
    generate_invoices,
    get_collection_report,
    get_defaulters,
    get_invoice_total_with_late_fee,
    get_ledger_summary,
    get_student_ledger,
    record_payment,
)
from app.modules.fees.utils import calculate_late_fee

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
async def list_structures(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FeeStructure))
    return result.scalars().all()


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
    )
    db.add(new_struct)
    await db.flush()

    installments_result = await db.execute(
        select(FeeInstallment).where(FeeInstallment.structure_id == structure_id)
    )
    for inst in installments_result.scalars().all():
        new_inst = FeeInstallment(
            structure_id=new_struct.id,
            name=inst.name,
            due_date=inst.due_date,
            percent=inst.percent,
        )
        db.add(new_inst)
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
    await db.flush()
    return struct


@router.delete("/structures/{structure_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=admin_only)
async def delete_structure(structure_id: str, db: AsyncSession = Depends(get_db)):
    struct = await db.get(FeeStructure, structure_id)
    if not struct:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    await db.delete(struct)


@router.post("/installments", response_model=FeeInstallmentResponse, dependencies=admin_only)
async def create_installment(body: FeeInstallmentCreate, db: AsyncSession = Depends(get_db)):
    inst = FeeInstallment(**body.model_dump())
    db.add(inst)
    await db.flush()
    return inst


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


@router.get("/invoices", response_model=list[InvoiceResponse])
async def list_invoices(
    student_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    q = select(Invoice).order_by(Invoice.due_date)

    scope = QueryScoper.for_invoices(db, current_user)
    if scope is not None:
        q = q.where(scope)

    if student_id:
        q = q.where(Invoice.student_id == student_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/invoices", response_model=InvoiceResponse, dependencies=admin_only)
async def create_invoice(body: InvoiceCreate, db: AsyncSession = Depends(get_db)):
    invoice = Invoice(**body.model_dump())
    db.add(invoice)
    await db.flush()
    return invoice


@router.post("/invoices/bulk-generate", dependencies=admin_only)
async def bulk_generate_invoices(body: dict, db: AsyncSession = Depends(get_db)):
    student_ids = body.get("student_ids", [])
    due_date = body.get("due_date")
    generated = 0
    for sid in student_ids:
        try:
            invs = await generate_invoices(sid, db)
            generated += len(invs)
        except HTTPException:
            continue
    return {"generated": generated}


@router.post("/invoices/generate/{student_id}", dependencies=admin_only)
async def generate_student_invoices(student_id: str, db: AsyncSession = Depends(get_db)):
    invoices = await generate_invoices(student_id, db)
    return {"generated": len(invoices)}


@router.get("/invoices/{invoice_id}", dependencies=all_auth)
async def get_invoice(invoice_id: str, db: AsyncSession = Depends(get_db)):
    invoice = await db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    late_fee = calculate_late_fee(invoice)
    total_due = invoice.net_amount + late_fee
    return {
        "id": str(invoice.id),
        "gross_amount": str(invoice.gross_amount),
        "discount_amount": str(invoice.discount_amount),
        "net_amount": str(invoice.net_amount),
        "late_fee": str(late_fee),
        "total_due": str(total_due),
        "due_date": str(invoice.due_date),
        "status": invoice.status,
        "paid_at": invoice.paid_at,
    }


@router.post("/orders", response_model=CreateOrderResponse, dependencies=all_auth)
async def create_order(invoice_id: str, db: AsyncSession = Depends(get_db)):
    invoice = await db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    if invoice.status == "PAID":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invoice already paid")

    total = get_invoice_total_with_late_fee(invoice)
    receipt = f"inv_{invoice_id[:8]}"
    razorpay_order = await create_razorpay_order(total, receipt)

    payment_order = PaymentOrder(
        invoice_id=invoice_id,
        razorpay_order_id=razorpay_order["id"],
        amount=total,
    )
    db.add(payment_order)
    invoice.razorpay_order_id = razorpay_order["id"]
    await db.flush()

    return CreateOrderResponse(
        razorpay_order_id=razorpay_order["id"],
        amount=total,
    )


@router.get("/orders", response_model=list[PaymentOrderResponse])
async def list_orders(
    invoice_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    q = select(PaymentOrder).order_by(PaymentOrder.created_at.desc())

    scope = QueryScoper.for_orders(db, current_user)
    if scope is not None:
        q = q.where(scope)

    if invoice_id:
        q = q.where(PaymentOrder.invoice_id == invoice_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/orders/{order_id}", response_model=PaymentOrderResponse, dependencies=all_auth)
async def get_order(order_id: str, db: AsyncSession = Depends(get_db)):
    order = await db.get(PaymentOrder, order_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return order


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


@router.post("/webhook/razorpay")
async def razorpay_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.body()
    signature = request.headers.get("x-razorpay-signature", "")
    if not verify_webhook_signature(body, signature):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature")
    payload = await request.json()
    return await handle_payment_webhook(payload, db)


@router.get("/ledger/{student_id}", response_model=list[StudentLedgerEntryResponse])
async def list_ledger_entries(
    student_id: str,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    entries = await get_student_ledger(db, student_id, limit, offset)
    # Apply role scope for teacher/parent/student
    scope = QueryScoper.for_ledger(db, current_user)
    if scope is not None:
        from sqlalchemy import select as sel
        filtered = [e for e in entries if True]  # scope applied at query level in future
    return entries


@router.get("/ledger/{student_id}/summary", response_model=LedgerSummaryResponse)
async def student_ledger_summary(
    student_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    summary = await get_ledger_summary(db, student_id)
    return summary


@router.post("/payments", response_model=PaymentResponse, dependencies=admin_only)
async def record_payment_endpoint(
    body: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    result = await record_payment(
        db,
        invoice_id=str(body.invoice_id),
        amount=body.amount,
        mode=body.mode,
        reference_no=body.reference_no,
        received_by=current_user["id"],
        notes=body.notes,
    )
    payment = await db.execute(
        select(Payment).where(Payment.id == result["payment_id"])
    )
    return payment.scalar_one()


@router.get("/payments", response_model=list[PaymentResponse])
async def list_payments(
    invoice_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    q = select(Payment).order_by(Payment.created_at.desc())
    if invoice_id:
        q = q.where(Payment.invoice_id == invoice_id)
    result = await db.execute(q)
    return result.scalars().all()


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
