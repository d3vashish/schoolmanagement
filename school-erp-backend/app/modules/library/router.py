from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, role_required
from app.modules.library.models import Book, BookCopy, BookIssue, BookCategory, Fine, Reservation
from app.modules.library.schemas import (
    BookCopyCreate,
    BookCopyResponse,
    BookCreate,
    BookResponse,
    CategoryCreate,
    CategoryResponse,
    IssueResponse,
)
from app.modules.library.service import issue_book, reserve_book, return_book

librarian_admin = [role_required("super_admin", "principal", "librarian")]
all_auth = [Depends(get_current_user)]

router = APIRouter(prefix="/library", tags=["library"])


@router.get("/categories", response_model=list[CategoryResponse], dependencies=all_auth)
async def list_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BookCategory).order_by(BookCategory.name))
    return result.scalars().all()


@router.post("/categories", response_model=CategoryResponse, dependencies=librarian_admin)
async def create_category(body: CategoryCreate, db: AsyncSession = Depends(get_db)):
    cat = BookCategory(**body.model_dump())
    db.add(cat)
    await db.flush()
    return cat


@router.get("/books", response_model=list[BookResponse], dependencies=all_auth)
async def list_books(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Book).order_by(Book.title))
    return result.scalars().all()


@router.post("/books", response_model=BookResponse, dependencies=librarian_admin)
async def create_book(body: BookCreate, db: AsyncSession = Depends(get_db)):
    book = Book(**body.model_dump())
    db.add(book)
    await db.flush()
    for i in range(book.total_copies):
        barcode = f"{book.id.hex[:8]}-{i+1:02d}"
        db.add(BookCopy(book_id=book.id, barcode=barcode))
    await db.flush()
    return book


@router.post("/copies", response_model=BookCopyResponse, dependencies=librarian_admin)
async def add_copy(body: BookCopyCreate, db: AsyncSession = Depends(get_db)):
    copy = BookCopy(**body.model_dump())
    db.add(copy)
    book = await db.get(Book, body.book_id)
    if book:
        book.total_copies += 1
    await db.flush()
    return copy


@router.post("/issue", response_model=IssueResponse, dependencies=librarian_admin)
async def issue(
    copy_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await issue_book(user_id, copy_id, current_user["id"], db)


@router.post("/return/{issue_id}", response_model=IssueResponse, dependencies=librarian_admin)
async def return_issue(issue_id: str, db: AsyncSession = Depends(get_db)):
    return await return_book(issue_id, db)


@router.get("/issues", response_model=list[IssueResponse], dependencies=all_auth)
async def list_issues(user_id: str | None = None, db: AsyncSession = Depends(get_db)):
    q = select(BookIssue).order_by(BookIssue.issue_date.desc())
    if user_id:
        q = q.where(BookIssue.issued_to == user_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/reserve")
async def reserve(
    book_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await reserve_book(book_id, current_user["id"], db)


@router.get("/fines/user/{user_id}", dependencies=all_auth)
async def user_fines(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Fine).where(Fine.user_id == user_id).order_by(Fine.created_at.desc())
    )
    return result.scalars().all()
