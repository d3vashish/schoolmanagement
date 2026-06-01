import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.modules.exams.models import ExamResult
from app.modules.auth.models import User


@pytest.mark.asyncio
async def test_exam_marks_optimistic_lock(client: AsyncClient, db_session):
    from tests.factories import (
        create_academic_year,
        create_class,
        create_student_profile,
        create_subject,
        create_user,
    )

    ay = await create_academic_year(db_session)
    cls = await create_class(db_session, ay.id)
    student = await create_student_profile(db_session)
    subj = await create_subject(db_session)
    teacher = await create_user(db_session, role="teacher", email="exam_teacher@test.edu")

    from app.modules.exams.models import Exam, ExamSubject

    exam = Exam(
        name="Midterms",
        academic_year_id=ay.id,
        class_id=cls.id,
        start_date=ay.start_date,
        end_date=ay.end_date,
    )
    db_session.add(exam)
    await db_session.flush()

    es = ExamSubject(exam_id=exam.id, subject_id=subj.id, max_marks=100)
    db_session.add(es)
    await db_session.flush()

    result = ExamResult(
        exam_id=exam.id,
        student_id=student.id,
        subject_id=subj.id,
        marks=80,
        max_marks=100,
    )
    db_session.add(result)
    await db_session.flush()

    from app.modules.exams.service import submit_marks

    stale_version = result.version

    r1 = await submit_marks(str(result.id), 90, False, stale_version, db_session)

    with pytest.raises(Exception):
        await submit_marks(str(result.id), 85, False, stale_version, db_session)


@pytest.mark.asyncio
async def test_marks_workflow_transition(client: AsyncClient, db_session):
    from tests.factories import (
        create_academic_year,
        create_class,
        create_student_profile,
        create_subject,
        create_user,
    )

    ay = await create_academic_year(db_session)
    cls = await create_class(db_session, ay.id)
    student = await create_student_profile(db_session)
    subj = await create_subject(db_session)
    teacher = await create_user(db_session, role="teacher", email="wf_teacher@test.edu")

    from app.modules.exams.models import Exam, ExamSubject

    exam = Exam(
        name="Finals",
        academic_year_id=ay.id,
        class_id=cls.id,
        start_date=ay.start_date,
        end_date=ay.end_date,
    )
    db_session.add(exam)
    await db_session.flush()

    es = ExamSubject(exam_id=exam.id, subject_id=subj.id, max_marks=100)
    db_session.add(es)
    await db_session.flush()

    result = ExamResult(
        exam_id=exam.id,
        student_id=student.id,
        subject_id=subj.id,
        marks=88,
        max_marks=100,
    )
    db_session.add(result)
    await db_session.flush()

    from app.modules.exams.service import transition_result_status

    async def _try_transition(from_status, to_status, expect_success):
            s = await db_session.get(ExamResult, result.id)
            s.status = from_status
            await db_session.flush()

            if expect_success:
                await transition_result_status(str(exam.id), from_status, to_status, db_session)
            else:
                with pytest.raises(Exception):
                    await transition_result_status(str(exam.id), from_status, to_status, db_session)

    await _try_transition("DRAFT", "SUBMITTED", True)
    await db_session.refresh(result)
    assert result.status == "SUBMITTED"
