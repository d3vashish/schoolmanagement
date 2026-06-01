from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class BookCreate(BaseModel):
    title: str
    author: str
    isbn: str | None = None
    publisher: str | None = None
    category_id: UUID | None = None
    total_copies: int = 1


class BookResponse(BaseModel):
    id: UUID
    title: str
    author: str
    isbn: str | None
    publisher: str | None
    category_id: UUID | None
    total_copies: int

    model_config = {"from_attributes": True}


class BookCopyCreate(BaseModel):
    book_id: UUID
    barcode: str


class BookCopyResponse(BaseModel):
    id: UUID
    book_id: UUID
    barcode: str
    status: str

    model_config = {"from_attributes": True}


class IssueResponse(BaseModel):
    id: UUID
    copy_id: UUID
    issued_to: UUID
    issue_date: date
    due_date: date
    status: str

    model_config = {"from_attributes": True}


class FineResponse(BaseModel):
    id: UUID
    issue_id: UUID
    user_id: UUID
    amount: Decimal
    reason: str
    is_paid: bool

    model_config = {"from_attributes": True}


class CategoryCreate(BaseModel):
    name: str
    description: str | None = None


class CategoryResponse(BaseModel):
    id: UUID
    name: str
    description: str | None

    model_config = {"from_attributes": True}
