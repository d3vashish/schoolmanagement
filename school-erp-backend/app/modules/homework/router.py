from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import QueryScoper, get_current_user, role_required
from app.modules.homework.models import HomeworkAssignment, HomeworkSubmission
from app.modules.homework.schemas import (
    HomeworkCreate,
    HomeworkGradeSubmission,
    HomeworkResponse,
    HomeworkSubmissionCreate,
    HomeworkSubmissionResponse,
    HomeworkUpdate,
)

admin_teacher = [role_required("super_admin", "principal", "teacher")]

router = APIRouter(prefix="/homework", tags=["homework"])


@router.get("", response_model=list[HomeworkResponse])
async def list_homework(
    student_group: str | None = None,
    course: str | None = None,
    assigned_by: str | None = None,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    q = select(HomeworkAssignment).order_by(HomeworkAssignment.assigned_date.desc())

    scope = QueryScoper.for_homework(db, current_user)
    if scope is not None:
        q = q.where(scope)

    if student_group:
        q = q.where(HomeworkAssignment.student_group == student_group)
    if course:
        q = q.where(HomeworkAssignment.course == course)
    if assigned_by:
        q = q.where(HomeworkAssignment.assigned_by == assigned_by)
    if status:
        q = q.where(HomeworkAssignment.status == status)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{homework_id}", response_model=HomeworkResponse)
async def get_homework(
    homework_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    hw = await db.get(HomeworkAssignment, homework_id)
    if not hw:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Homework not found")

    scope = QueryScoper.for_homework(db, current_user)
    if scope is not None:
        check = await db.execute(
            select(HomeworkAssignment).where(HomeworkAssignment.id == homework_id).where(scope)
        )
        if not check.first():
            raise HTTPException(status_code=403, detail="Access denied")

    return hw


@router.post("", response_model=HomeworkResponse, dependencies=admin_teacher)
async def create_homework(
    body: HomeworkCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    data = body.model_dump(exclude_none=True)
    data["assigned_by"] = current_user["id"]

    # Resolve the teacher's staff_profile id so for_homework's scoper
    # (which filters on created_by_id, the real FK) can actually find
    # this row again. Without this, every homework a teacher creates
    # is invisible in their own list immediately after creation.
    from app.modules.auth.models import StaffProfile
    sp = await db.execute(
        select(StaffProfile.id).where(StaffProfile.user_id == current_user["id"])
    )
    data["created_by_id"] = sp.scalar_one_or_none()

    # Resolve student_group (section name) too, since the student/parent
    # scopers in for_homework still filter on that legacy string column,
    # not section_id.
    if data.get("section_id"):
        from app.modules.academic.models import Section
        section = await db.get(Section, data["section_id"])
        if section:
            data["student_group"] = section.name

    hw = HomeworkAssignment(**data)
    db.add(hw)
    await db.flush()
    return hw


@router.patch("/{homework_id}", response_model=HomeworkResponse, dependencies=admin_teacher)
async def update_homework(homework_id: str, body: HomeworkUpdate, db: AsyncSession = Depends(get_db)):
    hw = await db.get(HomeworkAssignment, homework_id)
    if not hw:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Homework not found")

    update_data = body.model_dump(exclude_none=True)

    # Keep student_group in sync if section_id changes on an edit too,
    # for the same reason as in create_homework above.
    if "section_id" in update_data:
        from app.modules.academic.models import Section
        section = await db.get(Section, update_data["section_id"])
        if section:
            update_data["student_group"] = section.name

    for field, value in update_data.items():
        setattr(hw, field, value)
    await db.flush()
    return hw


@router.delete("/{homework_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=admin_teacher)
async def delete_homework(homework_id: str, db: AsyncSession = Depends(get_db)):
    hw = await db.get(HomeworkAssignment, homework_id)
    if not hw:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Homework not found")
    await db.delete(hw)


@router.post("/submissions", response_model=HomeworkSubmissionResponse, dependencies=[role_required("teacher", "student")])
async def create_submission(body: HomeworkSubmissionCreate, db: AsyncSession = Depends(get_db)):
    homework = await db.get(HomeworkAssignment, body.homework_id)
    if not homework:
        raise HTTPException(status_code=404, detail="Homework not found")
    result = await db.execute(
        select(HomeworkSubmission).where(
            HomeworkSubmission.homework_id == body.homework_id,
            HomeworkSubmission.student_id == body.student_id,
        )
    )
    if result.first():
        raise HTTPException(status_code=409, detail="Already submitted")
    sub = HomeworkSubmission(**body.model_dump())
    db.add(sub)
    return sub


@router.get("/submissions/{homework_id}", response_model=list[HomeworkSubmissionResponse], dependencies=[role_required("teacher", "principal", "super_admin")])
async def list_submissions(homework_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(HomeworkSubmission).where(HomeworkSubmission.homework_id == homework_id).order_by(HomeworkSubmission.submitted_at)
    )
    return result.scalars().all()


@router.patch("/submissions/{submission_id}/grade", response_model=HomeworkSubmissionResponse, dependencies=[role_required("teacher")])
async def grade_submission(submission_id: str, body: HomeworkGradeSubmission, db: AsyncSession = Depends(get_db)):
    sub = await db.get(HomeworkSubmission, submission_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    sub.marks = body.marks
    sub.remarks = body.remarks
    sub.graded_at = datetime.utcnow()
    sub.status = "GRADED"
    return sub