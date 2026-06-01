from sqlalchemy import Boolean, Column, Date, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base
from app.shared.models import TimestampMixin, VersionMixin


class GradingScheme(Base, TimestampMixin):
    __tablename__ = "grading_schemes"

    name = Column(String(100), nullable=False)
    grade_a_min = Column(Numeric(5, 2), nullable=True)
    grade_b_min = Column(Numeric(5, 2), nullable=True)
    grade_c_min = Column(Numeric(5, 2), nullable=True)
    grade_d_min = Column(Numeric(5, 2), nullable=True)
    grade_e_min = Column(Numeric(5, 2), nullable=True)

    def get_grade(self, percentage: float) -> str:
        if self.grade_a_min is not None and percentage >= self.grade_a_min:
            return "A"
        if self.grade_b_min is not None and percentage >= self.grade_b_min:
            return "B"
        if self.grade_c_min is not None and percentage >= self.grade_c_min:
            return "C"
        if self.grade_d_min is not None and percentage >= self.grade_d_min:
            return "D"
        if self.grade_e_min is not None and percentage >= self.grade_e_min:
            return "E"
        return "F"


GRADING_DEFAULT = {
    "name": "Standard",
    "grade_a_min": 90,
    "grade_b_min": 75,
    "grade_c_min": 60,
    "grade_d_min": 45,
    "grade_e_min": 35,
}


class Exam(Base, TimestampMixin):
    __tablename__ = "exams"

    name = Column(String(100), nullable=False)
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False)
    class_id = Column(UUID(as_uuid=True), ForeignKey("academic_classes.id"), nullable=False)
    grading_scheme_id = Column(UUID(as_uuid=True), ForeignKey("grading_schemes.id"), nullable=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    status = Column(String(20), nullable=False, default="DRAFT", index=True)


class ExamSubject(Base, TimestampMixin):
    __tablename__ = "exam_subjects"

    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id"), nullable=False)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("academic_subjects.id"), nullable=False)
    max_marks = Column(Numeric(5, 2), nullable=False)
    date = Column(Date, nullable=True)

    __table_args__ = (
        UniqueConstraint("exam_id", "subject_id", name="uq_exam_subject"),
    )


class ExamResult(Base, TimestampMixin, VersionMixin):
    __tablename__ = "exam_results"

    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id"), nullable=False, index=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("student_profiles.id"), nullable=False, index=True)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("academic_subjects.id"), nullable=False)
    marks = Column(Numeric(5, 2), nullable=True)
    max_marks = Column(Numeric(5, 2), nullable=False)
    is_absent = Column(Boolean, default=False, nullable=False)
    status = Column(String(20), nullable=False, default="DRAFT", index=True)

    __table_args__ = (
        UniqueConstraint("exam_id", "student_id", "subject_id", name="uq_exam_result_student_subject"),
    )


class ExamAggregate(Base, TimestampMixin):
    __tablename__ = "exam_aggregates"

    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id"), nullable=False, index=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("student_profiles.id"), nullable=False, index=True)
    total_marks = Column(Numeric(10, 2), nullable=False)
    max_total = Column(Numeric(10, 2), nullable=False)
    percentage = Column(Numeric(5, 2), nullable=False)
    grade = Column(String(2), nullable=True)
    rank = Column(Integer, nullable=True)

    __table_args__ = (
        UniqueConstraint("exam_id", "student_id", name="uq_exam_aggregate_student"),
    )


class ReportCard(Base, TimestampMixin):
    __tablename__ = "report_cards"

    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False)
    file_url = Column(String(500), nullable=False)
    generated_at = Column(Date, nullable=True)

    __table_args__ = (
        UniqueConstraint("exam_id", "student_id", name="uq_report_card_exam_student"),
    )
