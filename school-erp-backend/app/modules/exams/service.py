from pathlib import Path
from tempfile import NamedTemporaryFile
from uuid import UUID

from jinja2 import Environment, FileSystemLoader
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.exams.models import Exam, ExamAggregate, ExamResult, GradingScheme
from app.modules.academic.models import Subject
from app.modules.auth.models import StudentProfile
from app.modules.academic.models import Class
from app.shared.storage import upload_file

TEMPLATE_DIR = Path(__file__).resolve().parent.parent.parent / "templates"
env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))


def get_grade(percentage: float, scheme: GradingScheme | None) -> str | None:
    if not scheme:
        return None
    return scheme.get_grade(percentage)


async def submit_marks(result_id: str, marks, is_absent: bool, version: int, db: AsyncSession):
    result = await db.get(ExamResult, result_id)
    if not result:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Result not found")
    if result.version != version:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Version mismatch")
    result.marks = marks
    result.is_absent = is_absent
    result.version += 1
    await db.flush()
    return result


async def transition_result_status(exam_id: str, from_status: str, to_status: str, db: AsyncSession):
    stmt = (
        update(ExamResult)
        .where(ExamResult.exam_id == exam_id, ExamResult.status == from_status)
        .values(status=to_status)
    )
    result = await db.execute(stmt)
    await db.flush()
    return result.rowcount


async def generate_report_card_for_student(
    exam_id: UUID,
    student_id: UUID,
    db: AsyncSession,
) -> str:
    exam = await db.get(Exam, exam_id)
    if not exam:
        raise ValueError("Exam not found")

    scheme = None
    if exam.grading_scheme_id:
        scheme = await db.get(GradingScheme, exam.grading_scheme_id)

    rows_result = await db.execute(
        select(ExamResult, Subject.name)
        .join(Subject, ExamResult.subject_id == Subject.id)
        .where(
            ExamResult.exam_id == exam_id,
            ExamResult.student_id == student_id,
            ExamResult.status == "PUBLISHED",
        )
    )
    rows = rows_result.all()

    student = await db.get(StudentProfile, student_id)
    if not student:
        raise ValueError("Student not found")

    class_ = None
    if student.class_id:
        class_ = await db.get(Class, student.class_id)

    aggregate = (
        await db.execute(
            select(ExamAggregate).where(
                ExamAggregate.exam_id == exam_id,
                ExamAggregate.student_id == student_id,
            )
        )
    ).scalar_one_or_none()

    result_rows = []
    for er, subject_name in rows:
        pct = 0.0
        if er.max_marks > 0 and not er.is_absent and er.marks is not None:
            pct = float(er.marks) / float(er.max_marks) * 100
        grade = get_grade(pct, scheme) if not er.is_absent else None
        result_rows.append({
            "subject_name": subject_name,
            "marks": er.marks,
            "max_marks": er.max_marks,
            "percentage": pct,
            "is_absent": er.is_absent,
            "grade": grade,
        })

    agg = None
    if aggregate:
        agg = {
            "total_marks": aggregate.total_marks,
            "max_total": aggregate.max_total,
            "percentage": float(aggregate.percentage),
            "grade": aggregate.grade,
            "rank": aggregate.rank,
        }

    from weasyprint import HTML

    template = env.get_template("report_card.html")
    html = template.render(
        student_name=f"{student.first_name} {student.last_name}",
        admission_number=student.admission_number,
        class_name=class_.name if class_ else "",
        exam_name=exam.name,
        results=result_rows,
        aggregate=agg,
    )

    pdf_bytes = HTML(string=html).write_pdf()

    object_key = f"report-cards/{exam_id}/{student_id}.pdf"
    with NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp_path = tmp.name
        tmp.write(pdf_bytes)

    try:
        url = await upload_file(tmp_path, object_key)
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    return url
