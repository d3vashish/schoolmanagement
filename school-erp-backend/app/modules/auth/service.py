from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.modules.auth.models import User


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email, User.deleted_at.is_(None)))
    return result.scalar_one_or_none()


async def get_user_by_phone(db: AsyncSession, phone: str) -> User | None:
    result = await db.execute(select(User).where(User.phone == phone, User.deleted_at.is_(None)))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: str) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    return result.scalar_one_or_none()


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User | None:
    user = await get_user_by_email(db, email)
    if not user or not user.hashed_pw or not verify_password(password, user.hashed_pw):
        return None
    if not user.is_active:
        return None
    return user


async def create_user(
    db: AsyncSession,
    email: str | None,
    phone: str | None,
    password: str | None,
    role: str,
) -> User:
    user = User(
        email=email,
        phone=phone,
        hashed_pw=hash_password(password) if password else None,
        role=role,
        is_active=True,
    )
    db.add(user)
    await db.flush()
    return user


async def issue_tokens(user_id: str, role: str) -> dict:
    access_token = create_access_token(user_id, role)
    refresh_token = await create_refresh_token(user_id)
    return {"access_token": access_token, "refresh_token": refresh_token}
