import sys
import pytest
from httpx import AsyncClient
from uuid import uuid4
from unittest.mock import AsyncMock, patch, MagicMock

from app.modules.exams.models import ExamResult, ReportCard, Exam, ExamSubject
from tests.factories import (
    create_academic_year,
    create_class,
    create_student_profile,
    create_subject,
    create_user,
)

pytestmark = pytest.mark.asyncio


async def _admin_headers(client: AsyncClient, db_session) -> dict:
    user = await create_user(db_session, email="admin_rc@test.edu", role="super_admin")
    resp = await client.post("/auth/login", json={
        "email": "admin_rc@test.edu",
        "password": "dummy",
    })
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def _make_exam_with_result(db_session):
    ay = await create_academic_year(db_session)
    cls = await create_class(db_session, ay.id)
    student = await create_student_profile(db_session)
    subj = await create_subject(db_session)

    exam = Exam(
        name="ReportCard Exam",
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
        status="PUBLISHED",
    )
    db_session.add(result)
    await db_session.flush()
    return exam, student


async def test_trigger_report_cards_returns_202(client, db_session):
    headers = await _admin_headers(client, db_session)
    exam, _ = await _make_exam_with_result(db_session)

    response = await client.post(
        f"/exams/{exam.id}/report-cards",
        headers=headers,
    )
    assert response.status_code == 202


async def test_trigger_report_cards_not_found(client, db_session):
    headers = await _admin_headers(client, db_session)
    response = await client.post(
        f"/exams/{uuid4()}/report-cards",
        headers=headers,
    )
    assert response.status_code == 404


async def test_get_report_card_not_found(client, db_session):
    headers = await _admin_headers(client, db_session)
    response = await client.get(
        f"/exams/{uuid4()}/report-cards/{uuid4()}",
        headers=headers,
    )
    assert response.status_code == 404


async def test_get_report_card_found(client, db_session):
    headers = await _admin_headers(client, db_session)
    exam, student = await _make_exam_with_result(db_session)

    card = ReportCard(
        exam_id=exam.id,
        student_id=student.id,
        file_url="http://minio/report-cards/test.pdf",
        generated_at=None,
    )
    db_session.add(card)
    await db_session.flush()

    response = await client.get(
        f"/exams/{exam.id}/report-cards/{student.id}",
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["file_url"] == "http://minio/report-cards/test.pdf"


async def test_report_card_service_generates_pdf(db_session):
    from app.modules.exams.service import generate_report_card_for_student
    ay = await create_academic_year(db_session)
    cls = await create_class(db_session, ay.id)
    student = await create_student_profile(db_session)
    subj = await create_subject(db_session)

    exam = Exam(
        name="Service Exam",
        academic_year_id=ay.id,
        class_id=cls.id,
        start_date=ay.start_date,
        end_date=ay.end_date,
    )
    db_session.add(exam)
    await db_session.flush()

    result = ExamResult(
        exam_id=exam.id,
        student_id=student.id,
        subject_id=subj.id,
        marks=85,
        max_marks=100,
        status="PUBLISHED",
    )
    db_session.add(result)
    await db_session.flush()

    mock_weasy = MagicMock()
    mock_html_instance = MagicMock()
    mock_html_instance.write_pdf.return_value = b"%PDF-dummy"
    mock_weasy.HTML.return_value = mock_html_instance
    sys.modules["weasyprint"] = mock_weasy
    try:
        with patch("app.modules.exams.service.upload_file", new_callable=AsyncMock) as mock_upload:
            mock_upload.return_value = "http://minio/report-cards/test.pdf"
            url = await generate_report_card_for_student(exam.id, student.id, db_session)
            assert url == "http://minio/report-cards/test.pdf"
            mock_upload.assert_called_once()
            args, _ = mock_upload.call_args
            assert "report-cards/" in args[1]
    finally:
        sys.modules.pop("weasyprint", None)
