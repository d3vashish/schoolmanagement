import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, role_required
from app.core.rate_limit import limiter
from app.modules.admissions.models import (
    REQUIRED_DOCS,
    Admission,
    AdmissionDocument,
    ALLOWED_TRANSITIONS,
)
from app.modules.admissions.schemas import (
    AdmissionCreate,
    AdmissionResponse,
    DocumentResponse,
    TransitionRequest,
)
from app.modules.admissions.service import enroll_student, transition_status
from app.shared.storage import s3_client

from app.core.config import settings

admin_only = [role_required("super_admin", "principal")]
all_auth = [Depends(get_current_user)]
teacher_admin = [role_required("super_admin", "principal", "teacher")]

router = APIRouter(prefix="/admissions", tags=["admissions"])

ALLOWED_MIME = {"image/jpeg", "image/jpg", "application/pdf"}
MAX_FILE_SIZE = 5 * 1024 * 1024


@router.get("/", response_model=list[AdmissionResponse], dependencies=all_auth)
async def list_admissions(
    status_filter: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(Admission).order_by(Admission.created_at.desc())
    if status_filter:
        q = q.where(Admission.status == status_filter.upper())
    result = await db.execute(q)
    admissions = result.scalars().all()
    for a in admissions:
        await db.refresh(a)
    return admissions


@router.post("/", response_model=AdmissionResponse, status_code=status.HTTP_201_CREATED)
async def create_admission(body: AdmissionCreate, db: AsyncSession = Depends(get_db)):
    admission = Admission(**body.model_dump())
    db.add(admission)
    await db.flush()
    await db.refresh(admission)
    return admission


@router.get("/{admission_id}", response_model=AdmissionResponse, dependencies=all_auth)
async def get_admission(admission_id: str, db: AsyncSession = Depends(get_db)):
    admission = await db.get(Admission, admission_id)
    if not admission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    await db.refresh(admission)
    return admission


@router.delete("/{admission_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=admin_only)
async def delete_admission(
    admission_id: str,
    db: AsyncSession = Depends(get_db),
):
    admission = await db.get(Admission, admission_id)
    if not admission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    result = await db.execute(
        select(AdmissionDocument).where(AdmissionDocument.admission_id == admission_id)
    )
    documents = result.scalars().all()
    for doc in documents:
        try:
            s3_client.delete_object(Bucket=settings.S3_BUCKET, Key=doc.file_key)
        except Exception:
            pass
        await db.delete(doc)

    await db.delete(admission)
    await db.flush()
    return None


@router.patch("/{admission_id}/status", response_model=AdmissionResponse, dependencies=teacher_admin)
async def update_status(
    admission_id: str,
    body: TransitionRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    admission = await db.get(Admission, admission_id)
    if not admission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    updated = await transition_status(admission, body.status.upper(), current_user["id"], db)
    await db.refresh(updated)
    return updated


@router.get("/transitions/{current_status}")
async def get_allowed_transitions(current_status: str):
    allowed = ALLOWED_TRANSITIONS.get(current_status.upper(), [])
    return {"current": current_status.upper(), "allowed": allowed}


@router.post("/{admission_id}/enroll", dependencies=teacher_admin)
@limiter.limit("10/minute")
async def enroll(
    request: Request,
    admission_id: str,
    section_id: str,
    academic_year_id: str | None = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    admission = await db.get(Admission, admission_id)
    if not admission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    if admission.status != "FEE_PENDING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admission must be in FEE_PENDING status to enroll",
        )
    student, temp_password = await enroll_student(
        admission, section_id, db, academic_year_id=academic_year_id
    )
    return {
        "student_id": str(student.id),
        "admission_number": student.admission_number,
        "temp_password": temp_password,
    }


@router.post("/{admission_id}/documents", response_model=DocumentResponse, dependencies=all_auth)
async def upload_document(
    admission_id: str,
    doc_type: str,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
):
    admission = await db.get(Admission, admission_id)
    if not admission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    if doc_type not in REQUIRED_DOCS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid doc_type. Allowed: {REQUIRED_DOCS}")

    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF and JPG files are allowed")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File exceeds 5MB limit")
    await file.seek(0)

    ext = "pdf" if file.content_type == "application/pdf" else "jpg"
    object_name = f"admissions/{admission_id}/{doc_type}/{uuid.uuid4()}.{ext}"

    s3_client.put_object(
        Bucket=settings.S3_BUCKET,
        Key=object_name,
        Body=content,
        ContentType=file.content_type,
    )

    doc = AdmissionDocument(
        admission_id=admission_id,
        doc_type=doc_type,
        file_key=object_name,
        status="PENDING",
    )
    db.add(doc)
    await db.flush()
    return doc


@router.post("/{admission_id}/documents/{doc_id}/verify", dependencies=teacher_admin)
async def verify_document(
    admission_id: str,
    doc_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    doc = await db.get(AdmissionDocument, doc_id)
    if not doc or str(doc.admission_id) != admission_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    doc.status = "VERIFIED"
    doc.verified_by = current_user["id"]
    doc.verified_at = datetime.now(timezone.utc)
    await db.flush()
    return doc


@router.get("/{admission_id}/documents", response_model=list[DocumentResponse], dependencies=all_auth)
async def list_documents(admission_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AdmissionDocument).where(AdmissionDocument.admission_id == admission_id)
    )
    return result.scalars().all()