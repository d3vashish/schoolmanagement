from datetime import date, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.library.models import BookCopy, BookIssue, Fine, Reservation

FINE_PER_DAY = 5
MAX_BORROW = 2


async def count_active_issues(user_id: str, db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count(BookIssue.id)).where(
            BookIssue.issued_to == user_id,
            BookIssue.status == "ISSUED",
        )
    )
    return result.scalar() or 0


async def get_pending_fine(user_id: str, db: AsyncSession) -> float:
    result = await db.execute(
        select(func.coalesce(func.sum(Fine.amount), 0)).where(
            Fine.user_id == user_id,
            Fine.is_paid == False,
        )
    )
    return float(result.scalar() or 0)


async def issue_book(user_id: str, copy_id: str, issued_by: str, db: AsyncSession) -> BookIssue:
    copy_result = await db.execute(
        select(BookCopy).where(BookCopy.id == copy_id).with_for_update()
    )
    copy = copy_result.scalar_one_or_none()
    if not copy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Copy not found")
    if copy.status != "AVAILABLE":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Copy is not available")

    active = await count_active_issues(user_id, db)
    if active >= MAX_BORROW:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Borrow limit reached")

    pending_fine = await get_pending_fine(user_id, db)
    if pending_fine > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Clear pending fine of ₹{pending_fine:.0f} first",
        )

    copy.status = "ISSUED"
    issue = BookIssue(
        copy_id=copy_id,
        issued_to=user_id,
        issued_by=issued_by,
        due_date=date.today() + timedelta(days=14),
    )
    db.add(issue)
    await db.flush()
    return issue


async def return_book(issue_id: str, db: AsyncSession) -> BookIssue:
    issue = await db.get(BookIssue, issue_id)
    if not issue:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")
    if issue.status == "RETURNED":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already returned")

    issue.returned_date = date.today()
    issue.status = "RETURNED"

    copy = await db.get(BookCopy, issue.copy_id)
    if copy:
        copy.status = "AVAILABLE"

    overdue_days = (date.today() - issue.due_date).days
    if overdue_days > 0:
        fine_amount = overdue_days * FINE_PER_DAY
        fine = Fine(
            issue_id=issue.id,
            user_id=issue.issued_to,
            amount=fine_amount,
            reason=f"Overdue by {overdue_days} days",
        )
        db.add(fine)

    await db.flush()
    return issue


async def reserve_book(book_id: str, user_id: str, db: AsyncSession) -> Reservation:
    existing = await db.execute(
        select(Reservation).where(
            Reservation.book_id == book_id,
            Reservation.user_id == user_id,
            Reservation.status == "WAITING",
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already reserved")

    reservation = Reservation(book_id=book_id, user_id=user_id)
    db.add(reservation)
    await db.flush()
    return reservation
