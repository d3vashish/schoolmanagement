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
REPORTCARD_DIR = Path(__file__).resolve().parent.parent.parent / "static" / "report-cards"


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

    # A student's class comes from the exam (StudentProfile has no class_id).
    class_ = None
    if exam.class_id:
        class_ = await db.get(Class, exam.class_id)

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

    # Build the PDF with fpdf2 (pure-Python; no system libraries required).
    from fpdf import FPDF

    def _s(v):
        return "" if v is None else str(v)

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "Report Card", ln=1, align="C")
    pdf.ln(2)
    pdf.set_font("Helvetica", "", 11)
    pdf.cell(0, 8, f"Name: {student.first_name or ''} {student.last_name or ''}".strip(), ln=1)
    if getattr(student, "admission_number", None):
        pdf.cell(0, 8, f"Admission No: {student.admission_number}", ln=1)
    pdf.cell(0, 8, f"Class: {class_.name if class_ else ''}", ln=1)
    pdf.cell(0, 8, f"Exam: {exam.name}", ln=1)
    pdf.ln(4)

    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(85, 8, "Subject", border=1)
    pdf.cell(30, 8, "Marks", border=1, align="C")
    pdf.cell(30, 8, "Max", border=1, align="C")
    pdf.cell(35, 8, "Grade", border=1, align="C", ln=1)
    pdf.set_font("Helvetica", "", 11)
    for row in result_rows:
        marks = "Absent" if row.get("is_absent") else (_s(row.get("marks")) if row.get("marks") is not None else "-")
        pdf.cell(85, 8, _s(row.get("subject_name")), border=1)
        pdf.cell(30, 8, marks, border=1, align="C")
        pdf.cell(30, 8, _s(row.get("max_marks")), border=1, align="C")
        pdf.cell(35, 8, _s(row.get("grade") or "-"), border=1, align="C", ln=1)
    pdf.ln(5)

    if agg:
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 8, f"Total: {_s(agg.get('total_marks'))}/{_s(agg.get('max_total'))}", ln=1)
        pct = agg.get("percentage")
        pdf.cell(0, 8, f"Percentage: {pct:.1f}%" if isinstance(pct, (int, float)) else "Percentage: -", ln=1)
        pdf.cell(0, 8, f"Grade: {_s(agg.get('grade') or '-')}    Rank: {_s(agg.get('rank') or '-')}", ln=1)

    out_dir = REPORTCARD_DIR / str(exam_id)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{student_id}.pdf"
    pdf.output(str(out_path))

    return f"/exams/{exam_id}/report-cards/{student_id}/download"