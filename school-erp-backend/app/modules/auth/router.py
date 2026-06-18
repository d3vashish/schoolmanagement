from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, role_required
from app.core.rate_limit import limiter
from app.core.security import (
    check_otp_rate_limit,
    consume_refresh_token,
    create_otp,
    hash_password,
    revoke_refresh_token,
    store_otp,
    verify_otp,
)
from app.modules.academic.models import Enrollment
from app.modules.auth.models import ROLES, StudentProfile, StaffProfile, ParentProfile, User
from app.modules.auth.schemas import (
    LoginRequest,
    LoginResponse,
    OTPRequest,
    OTPVerify,
    RefreshRequest,
    TokenResponse,
    UserCreate,
    UserUpdate,
    UserResponse,
)
from app.modules.auth.service import (
    authenticate_user,
    get_user_by_email,
    get_user_by_id,
    get_user_by_phone,
    issue_tokens,
)

admin_only = [role_required("super_admin", "principal")]

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
@limiter.limit("10/minute")
async def login(request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, body.email, body.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    tokens = await issue_tokens(str(user.id), user.role)
    return LoginResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        user_id=str(user.id),
        role=user.role,
    )


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("30/minute")
async def refresh(request: Request, body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    user_id = await consume_refresh_token(body.refresh_token)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")
    user = await get_user_by_id(db, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    tokens = await issue_tokens(str(user.id), user.role)
    return TokenResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(body: RefreshRequest):
    await revoke_refresh_token(body.refresh_token)


@router.post("/otp/request")
async def request_otp(body: OTPRequest, db: AsyncSession = Depends(get_db)):
    user = await get_user_by_phone(db, body.phone)
    if not user or user.role != "parent":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if not await check_otp_rate_limit(body.phone):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many requests")
    otp = create_otp()
    await store_otp(body.phone, otp)
    return {"message": "OTP sent"}


@router.post("/otp/verify", response_model=TokenResponse)
@limiter.limit("5/minute")
async def verify_otp_login(request: Request, body: OTPVerify, db: AsyncSession = Depends(get_db)):
    if not await verify_otp(body.phone, body.otp):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid OTP")
    user = await get_user_by_phone(db, body.phone)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    tokens = await issue_tokens(str(user.id), user.role)
    return TokenResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
    )


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    user = await get_user_by_id(db, current_user["id"])
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    result = {
        "id": str(user.id),
        "email": user.email,
        "phone": user.phone,
        "role": user.role,
        "is_active": user.is_active,
    }
    if user.role == "teacher":
        from app.modules.academic.models import Section
        sec = (await db.execute(
            select(Section).where(Section.class_teacher_id == user.id)
        )).scalars().first()
        if sec and sec.class_id:
            from app.modules.academic.models import Class as AcademicClass
            cls = await db.get(AcademicClass, sec.class_id)
            result["mySection"] = {
                "name": sec.name,
                "program": cls.name if cls else "",
                "student_group_name": f"{cls.name} - {sec.name}" if cls else sec.name,
                "id": str(sec.id),
            }
    return result


def _build_user_response(user: User) -> dict:
    profile = None
    if user.role == "student":
        for p in user.student_profiles or []:
            profile = p
            break
    elif user.role in ("teacher", "accountant", "librarian"):
        for p in user.staff_profiles or []:
            profile = p
            break
    elif user.role == "parent":
        for p in user.parent_profiles or []:
            profile = p
            break
    return {
        "id": str(user.id),
        "email": user.email,
        "phone": user.phone,
        "role": user.role,
        "is_active": user.is_active,
        "first_name": getattr(profile, "first_name", None),
        "last_name": getattr(profile, "last_name", None),
        "employee_id": getattr(profile, "employee_id", None),
        "department": getattr(profile, "department", None),
        "qualification": getattr(profile, "qualification", None),
        "admission_number": getattr(profile, "admission_number", None),
        "class_id": str(getattr(profile, "class_id", "")) if getattr(profile, "class_id", None) else None,
        "guardian_name": getattr(profile, "guardian_name", None),
        "guardian_phone": getattr(profile, "guardian_phone", None),
        "address": getattr(profile, "address", None),
        "date_of_birth": getattr(profile, "date_of_birth", None),
        "created_at": user.created_at,
    }


@router.get("/users", response_model=list[UserResponse], dependencies=admin_only)
async def list_users(
    role: str | None = None,
    class_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(User).where(User.deleted_at.is_(None))
    if role:
        q = q.where(User.role == role)
    if class_id:
        q = q.where(
            User.id.in_(
                select(StudentProfile.user_id).where(
                    StudentProfile.id.in_(
                        select(Enrollment.student_id).where(
                            Enrollment.class_id == class_id,
                            Enrollment.status == "ACTIVE",
                        )
                    )
                )
            )
        )
    q = q.order_by(User.created_at.desc())
    result = await db.execute(q.options(selectinload(User.student_profiles), selectinload(User.staff_profiles), selectinload(User.parent_profiles)))
    users = result.scalars().all()
    return [_build_user_response(u) for u in users]


@router.get("/users/{user_id}", response_model=UserResponse, dependencies=admin_only)
async def get_user(user_id: str, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id, options=[selectinload(User.student_profiles), selectinload(User.staff_profiles), selectinload(User.parent_profiles)])
    if not user or user.deleted_at is not None:
        user = (await db.execute(
            select(User).where(User.email == user_id, User.deleted_at.is_(None))
            .options(selectinload(User.student_profiles), selectinload(User.staff_profiles), selectinload(User.parent_profiles))
        )).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _build_user_response(user)


@router.post("/users", response_model=UserResponse, dependencies=admin_only)
async def create_user_endpoint(body: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await get_user_by_email(db, body.email)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    if body.role not in ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid role. Must be one of: {', '.join(ROLES)}")
    user = User(
        email=body.email,
        phone=body.phone,
        hashed_pw=hash_password(body.password),
        role=body.role,
        is_active=True,
    )
    db.add(user)
    await db.flush()
    if body.role == "student":
        profile = StudentProfile(
            user_id=user.id,
            first_name=body.first_name,
            last_name=body.last_name,
            date_of_birth=body.date_of_birth,
            admission_number=body.admission_number or f"STU-{user.id}",
            class_id=body.class_id,
            guardian_name=body.guardian_name,
            guardian_phone=body.guardian_phone,
            address=body.address,
        )
        db.add(profile)
    elif body.role in ("teacher", "accountant", "librarian"):
        profile = StaffProfile(
            user_id=user.id,
            first_name=body.first_name,
            last_name=body.last_name,
            employee_id=body.employee_id or f"EMP-{user.id}",
            department=body.department,
            qualification=body.qualification,
            joining_date=None,
        )
        db.add(profile)
    elif body.role == "parent":
        profile = ParentProfile(
            user_id=user.id,
            first_name=body.first_name,
            last_name=body.last_name,
            email=body.email,
            phone=body.phone,
            address=body.address,
        )
        db.add(profile)
    await db.flush()
    await db.refresh(user, ["student_profiles", "staff_profiles", "parent_profiles"])
    return _build_user_response(user)


@router.patch("/users/{user_id}", response_model=UserResponse, dependencies=admin_only)
async def update_user(user_id: str, body: UserUpdate, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id, options=[selectinload(User.student_profiles), selectinload(User.staff_profiles), selectinload(User.parent_profiles)])
    if not user or user.deleted_at is not None:
        user = (await db.execute(
            select(User).where(User.email == user_id, User.deleted_at.is_(None))
            .options(selectinload(User.student_profiles), selectinload(User.staff_profiles), selectinload(User.parent_profiles))
        )).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if body.email is not None:
        user.email = body.email
    if body.phone is not None:
        user.phone = body.phone
    if body.password is not None:
        user.hashed_pw = hash_password(body.password)
    if body.role is not None:
        if body.role not in ROLES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid role. Must be one of: {', '.join(ROLES)}")
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active
    profile = None
    if user.role == "student" and user.student_profiles:
        profile = user.student_profiles[0]
    elif user.role in ("teacher", "accountant", "librarian") and user.staff_profiles:
        profile = user.staff_profiles[0]
    elif user.role == "parent" and user.parent_profiles:
        profile = user.parent_profiles[0]
    if profile:
        if body.first_name is not None:
            profile.first_name = body.first_name
        if body.last_name is not None:
            profile.last_name = body.last_name
        if body.date_of_birth is not None and hasattr(profile, "date_of_birth"):
            profile.date_of_birth = body.date_of_birth
        if body.address is not None and hasattr(profile, "address"):
            profile.address = body.address
        if hasattr(profile, "class_id") and body.class_id is not None:
            profile.class_id = body.class_id
        if hasattr(profile, "guardian_name") and body.guardian_name is not None:
            profile.guardian_name = body.guardian_name
        if hasattr(profile, "guardian_phone") and body.guardian_phone is not None:
            profile.guardian_phone = body.guardian_phone
        if hasattr(profile, "employee_id") and body.employee_id is not None:
            profile.employee_id = body.employee_id
        if hasattr(profile, "department") and body.department is not None:
            profile.department = body.department
        if hasattr(profile, "qualification") and body.qualification is not None:
            profile.qualification = body.qualification
    await db.flush()
    return _build_user_response(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=admin_only)
async def delete_user(user_id: str, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user or user.deleted_at is not None:
        user = (await db.execute(
            select(User).where(User.email == user_id, User.deleted_at.is_(None))
        )).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    from datetime import datetime, timezone
    user.deleted_at = datetime.now(timezone.utc)
    user.is_active = False
    await db.flush()
