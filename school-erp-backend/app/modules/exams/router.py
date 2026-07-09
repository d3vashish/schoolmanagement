from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, role_required
from app.modules.exams.models import (
    Exam,
    ExamAggregate,
    ExamResult,
    ExamSubject,
    GradingScheme,
    GRADING_DEFAULT,
    ReportCard,
)
from app.modules.exams.schemas import (
    AggregateResponse,
    ExamCreate,
    ExamResponse,
    ExamResultResponse,
    ExamSubjectCreate,
    ExamSubjectResponse,
    GradingSchemeCreate,
    GradingSchemeResponse,
    MarksEntry,
    MarksUpdate,
    ReportCardResponse,
)
from app.modules.exams.service import submit_marks, transition_result_status
from app.modules.exams.tasks import generate_report_cards as generate_report_cards_task

teacher_admin = [role_required("super_admin", "principal", "teacher")]
hod_admin = [role_required("super_admin", "principal")]
all_auth = [Depends(get_current_user)]

router = APIRouter(prefix="/exams", tags=["exams"])


@router.get("/grading-schemes", response_model=list[GradingSchemeResponse], dependencies=all_auth)
async def list_schemes(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(GradingScheme))
    return result.scalars().all()


@router.post("/grading-schemes", response_model=GradingSchemeResponse, dependencies=hod_admin)
async def create_scheme(body: GradingSchemeCreate, db: AsyncSession = Depends(get_db)):
    scheme = GradingScheme(**body.model_dump())
    db.add(scheme)
    await db.flush()
    return scheme


@router.get("", response_model=list[ExamResponse], dependencies=all_auth)
async def list_exams(class_id: str | None = None, db: AsyncSession = Depends(get_db)):
    q = select(Exam).order_by(Exam.start_date.desc())
    if class_id:
        q = q.where(Exam.class_id == class_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=ExamResponse, dependencies=hod_admin)
async def create_exam(body: ExamCreate, db: AsyncSession = Depends(get_db)):
    exam = Exam(**body.model_dump())
    db.add(exam)
    await db.flush()
    return exam


@router.post("/{exam_id}/subjects", dependencies=hod_admin)
async def add_exam_subject(
    exam_id: str,
    body: ExamSubjectCreate,
    db: AsyncSession = Depends(get_db),
):
    es = ExamSubject(exam_id=exam_id, subject_id=body.subject_id, max_marks=body.max_marks, date=body.date)
    db.add(es)
    await db.flush()
    return {"ok": True}


@router.get("/{exam_id}/subjects", response_model=list[ExamSubjectResponse], dependencies=all_auth)
async def get_exam_subjects(exam_id: str, db: AsyncSession = Depends(get_db)):
    from app.modules.academic.models import Subject
    result = await db.execute(
        select(ExamSubject, Subject.name.label("subject_name"))
        .join(Subject, ExamSubject.subject_id == Subject.id)
        .where(ExamSubject.exam_id == exam_id)
    )
    
    subjects = []
    for es, subject_name in result.all():
        data = es.__dict__.copy()
        data["subject_name"] = subject_name
        subjects.append(data)
    
    return subjects


@router.post("/{exam_id}/results/bulk", dependencies=teacher_admin)
async def bulk_entry(
    exam_id: str,
    entries: list[MarksEntry],
    db: AsyncSession = Depends(get_db),
):
    created = 0
    for entry in entries:
        existing = await db.execute(
            select(ExamResult).where(
                ExamResult.exam_id == exam_id,
                ExamResult.student_id == str(entry.student_id),
                ExamResult.subject_id == str(entry.subject_id),
            )
        )
        result = existing.scalar_one_or_none()
        if result:
            if result.status not in ("DRAFT", "SUBMITTED"):
                continue
            result.marks = entry.marks
            result.is_absent = entry.is_absent
        else:
            result = ExamResult(
                exam_id=exam_id,
                student_id=entry.student_id,
                subject_id=entry.subject_id,
                marks=entry.marks,
                max_marks=entry.max_marks,
                is_absent=entry.is_absent,
            )
            db.add(result)
        created += 1
    await db.flush()
    return {"created_or_updated": created}


@router.patch("/results/{result_id}", response_model=ExamResultResponse, dependencies=teacher_admin)
async def update_marks(
    result_id: str,
    body: MarksUpdate,
    db: AsyncSession = Depends(get_db),
):
    return await submit_marks(result_id, body.marks, body.is_absent, body.version, db)


@router.post("/{exam_id}/submit", dependencies=teacher_admin)
async def submit_results(exam_id: str, db: AsyncSession = Depends(get_db)):
    count = await transition_result_status(exam_id, "DRAFT", "SUBMITTED", db)
    exam = await db.get(Exam, exam_id)
    if exam:
        exam.status = "SUBMITTED"
        await db.flush()
    return {"updated": count, "new_status": "SUBMITTED"}


@router.post("/{exam_id}/approve", dependencies=hod_admin)
async def approve_results(exam_id: str, db: AsyncSession = Depends(get_db)):
    count = await transition_result_status(exam_id, "SUBMITTED", "APPROVED", db)
    exam = await db.get(Exam, exam_id)
    if exam:
        exam.status = "APPROVED"
        await db.flush()
    return {"updated": count, "new_status": "APPROVED"}


@router.post("/{exam_id}/publish", dependencies=hod_admin)
async def publish_results(exam_id: str, db: AsyncSession = Depends(get_db)):
    count = await transition_result_status(exam_id, "APPROVED", "PUBLISHED", db)
    exam = await db.get(Exam, exam_id)
    if exam:
        exam.status = "PUBLISHED"
        await db.flush()
    return {"updated": count, "new_status": "PUBLISHED"}


@router.get("/{exam_id}/results", response_model=list[ExamResultResponse], dependencies=all_auth)
async def get_results(exam_id: str, student_id: str | None = None, db: AsyncSession = Depends(get_db)):
    from app.modules.academic.models import Subject
    from app.modules.auth.models import StudentProfile
    
    q = (
        select(
            ExamResult,
            StudentProfile.first_name,
            StudentProfile.last_name,
            Subject.name.label("subject_name"),
        )
        .join(StudentProfile, ExamResult.student_id == StudentProfile.id)
        .join(Subject, ExamResult.subject_id == Subject.id)
        .where(ExamResult.exam_id == exam_id)
    )
    if student_id:
        q = q.where(ExamResult.student_id == student_id)
    result = await db.execute(q)
    
    results_out = []
    for er, fname, lname, sname in result.all():
        data = er.__dict__.copy()
        data["student_name"] = f"{fname} {lname}".strip()
        data["subject_name"] = sname
        results_out.append(data)
        
    return results_out


@router.get("/{exam_id}/aggregates", response_model=list[AggregateResponse], dependencies=all_auth)
async def get_aggregates(exam_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ExamAggregate).where(ExamAggregate.exam_id == exam_id)
        .order_by(ExamAggregate.rank)
    )
    return result.scalars().all()


@router.post("/{exam_id}/compute", dependencies=hod_admin)
async def compute(exam_id: str):
    # Run synchronously (no Celery worker in this deployment).
    from app.modules.exams.tasks import _compute_results_async
    result = await _compute_results_async(exam_id)
    return {"message": "Computation complete", "exam_id": exam_id, **(result or {})}


@router.post("/grade-defaults", dependencies=hod_admin)
async def seed_default_scheme(db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(GradingScheme).where(GradingScheme.name == "Standard"))
    if existing.scalar_one_or_none():
        return {"message": "Already exists"}
    scheme = GradingScheme(**GRADING_DEFAULT)
    db.add(scheme)
    await db.flush()
    return {"message": "Created", "id": str(scheme.id)}


@router.post("/{exam_id}/report-cards", dependencies=hod_admin)
async def trigger_report_cards(
    exam_id: str,
    db: AsyncSession = Depends(get_db),
):
    # Generate report cards synchronously (no Celery worker in this deployment).
    from datetime import date as _date
    from app.modules.exams.service import generate_report_card_for_student

    exam = await db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")

    student_ids = (await db.execute(
        select(ExamResult.student_id)
        .where(ExamResult.exam_id == exam_id, ExamResult.status == "PUBLISHED")
        .distinct()
    )).scalars().all()

    if not student_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No published results yet. Publish results first.")

    generated = 0
    errors = []
    for sid in student_ids:
        try:
            url = await generate_report_card_for_student(exam_id, sid, db)
            existing = (await db.execute(
                select(ReportCard).where(ReportCard.exam_id == exam_id, ReportCard.student_id == sid)
            )).scalar_one_or_none()
            if existing:
                existing.file_url = url
                existing.generated_at = _date.today()
            else:
                db.add(ReportCard(exam_id=exam_id, student_id=sid, file_url=url, generated_at=_date.today()))
            generated += 1
        except Exception as e:  # noqa: BLE001 - report per-student failures without aborting the batch
            errors.append(f"{sid}: {e}")

    await db.flush()
    return {"generated": generated, "errors": errors}


@router.get("/{exam_id}/report-cards/{student_id}", response_model=ReportCardResponse, dependencies=all_auth)
async def get_report_card(
    exam_id: str,
    student_id: str,
    db: AsyncSession = Depends(get_db),
):
    card = (
        await db.execute(
            select(ReportCard).where(
                ReportCard.exam_id == exam_id,
                ReportCard.student_id == student_id,
            )
        )
    ).scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report card not found")
    return card


@router.get("/{exam_id}/report-cards/{student_id}/download", dependencies=all_auth)
async def download_report_card(exam_id: str, student_id: str):
    from app.modules.exams.service import REPORTCARD_DIR
    path = REPORTCARD_DIR / str(exam_id) / f"{student_id}.pdf"
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report card not generated yet")
    return FileResponse(str(path), media_type="application/pdf", filename=f"report-card-{student_id}.pdf")