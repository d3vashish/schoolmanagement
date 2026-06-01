from datetime import date

from sqlalchemy import Boolean, Column, Date, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base
from app.shared.models import TimestampMixin


class BookCategory(Base, TimestampMixin):
    __tablename__ = "book_categories"

    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)


class Book(Base, TimestampMixin):
    __tablename__ = "books"

    title = Column(String(300), nullable=False)
    author = Column(String(200), nullable=False)
    isbn = Column(String(20), unique=True, nullable=True)
    publisher = Column(String(200), nullable=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("book_categories.id"), nullable=True)
    total_copies = Column(Integer, nullable=False, default=1)


class BookCopy(Base, TimestampMixin):
    __tablename__ = "book_copies"

    book_id = Column(UUID(as_uuid=True), ForeignKey("books.id"), nullable=False)
    barcode = Column(String(50), unique=True, nullable=False)
    status = Column(String(20), nullable=False, default="AVAILABLE", index=True)


class BookIssue(Base, TimestampMixin):
    __tablename__ = "book_issues"

    copy_id = Column(UUID(as_uuid=True), ForeignKey("book_copies.id"), nullable=False)
    issued_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    issued_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    issue_date = Column(Date, nullable=False, default=date.today)
    due_date = Column(Date, nullable=False)
    returned_date = Column(Date, nullable=True)
    status = Column(String(20), nullable=False, default="ISSUED", index=True)


class Reservation(Base, TimestampMixin):
    __tablename__ = "book_reservations"

    book_id = Column(UUID(as_uuid=True), ForeignKey("books.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    reserved_at = Column(Date, nullable=False, default=date.today)
    status = Column(String(20), nullable=False, default="WAITING", index=True)


class Fine(Base, TimestampMixin):
    __tablename__ = "library_fines"

    issue_id = Column(UUID(as_uuid=True), ForeignKey("book_issues.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    amount = Column(Numeric(10, 2), nullable=False)
    reason = Column(String(100), nullable=False)
    is_paid = Column(Boolean, default=False, nullable=False)
