from datetime import date

from celery import Celery
from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.modules.exams.models import (
    Exam,
    ExamAggregate,
    ExamResult,
    GradingScheme,
    ReportCard,
)
from app.modules.academic.models import Subject

celery_app = Celery("school_erp", broker=settings.REDIS_URL)


@celery_app.task(name="compute_results")
def compute_results(exam_id: str) -> dict:
    import asyncio
    return asyncio.run(_compute_results_async(exam_id))


async def _compute_results_async(exam_id: str) -> dict:
    async with AsyncSessionLocal() as db:
        exam = await db.get(Exam, exam_id)
        if not exam:
            raise ValueError(f"Exam {exam_id} not found")

        scheme = None
        if exam.grading_scheme_id:
            scheme = await db.get(GradingScheme, exam.grading_scheme_id)

        results_result = await db.execute(
            select(ExamResult).where(
                ExamResult.exam_id == exam_id,
                ExamResult.status == "PUBLISHED",
            )
        )
        results = results_result.scalars().all()

        student_map: dict[str, list[ExamResult]] = {}
        for r in results:
            student_map.setdefault(str(r.student_id), []).append(r)

        aggregates = []
        for student_id, student_results in student_map.items():
            graded = []
            for r in student_results:
                subj = await db.get(Subject, r.subject_id)
                if subj and subj.is_graded and not r.is_absent:
                    graded.append(r)

            total = sum((r.marks or 0) for r in graded)
            max_total = sum(r.max_marks for r in graded)
            percentage = (total / max_total * 100) if max_total else 0
            grade = scheme.get_grade(percentage) if scheme else None

            agg = ExamAggregate(
                exam_id=exam_id,
                student_id=student_id,
                total_marks=total,
                max_total=max_total,
                percentage=percentage,
                grade=grade,
            )
            db.add(agg)
            aggregates.append(agg)

        await db.flush()

        sorted_aggs = sorted(aggregates, key=lambda x: x.percentage, reverse=True)
        rank = 1
        for i, agg in enumerate(sorted_aggs):
            if i > 0 and agg.percentage < sorted_aggs[i - 1].percentage:
                rank = i + 1
            agg.rank = rank

        await db.commit()
        return {"exam_id": exam_id, "aggregates": len(aggregates)}


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def generate_report_cards(self, exam_id: str):
    import asyncio

    async def _run():
        async with AsyncSessionLocal() as db:
            student_ids_result = await db.execute(
                select(ExamResult.student_id)
                .where(ExamResult.exam_id == exam_id, ExamResult.status == "PUBLISHED")
                .distinct()
            )
            student_ids = student_ids_result.scalars().all()

            from app.modules.exams.service import generate_report_card_for_student

            for student_id in student_ids:
                try:
                    url = await generate_report_card_for_student(exam_id, student_id, db)

                    existing = (
                        await db.execute(
                            select(ReportCard).where(
                                ReportCard.exam_id == exam_id,
                                ReportCard.student_id == student_id,
                            )
                        )
                    ).scalar_one_or_none()

                    if existing:
                        existing.file_url = url
                        existing.generated_at = date.today()
                    else:
                        db.add(
                            ReportCard(
                                exam_id=exam_id,
                                student_id=student_id,
                                file_url=url,
                                generated_at=date.today(),
                            )
                        )

                    await db.flush()
                except Exception as exc:
                    self.retry(exc=exc)

            await db.commit()

    asyncio.run(_run())
