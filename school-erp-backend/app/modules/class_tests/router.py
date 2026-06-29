from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, role_required
from app.modules.class_tests.schemas import (
    BulkMarksUpdate,
    ClassTestCreate,
    ClassTestDetailResponse,
    ClassTestResponse,
    ClassTestUpdate,
)
from app.modules.class_tests.service import (
    create_test,
    delete_test,
    get_test_detail,
    get_test_with_counts,
    list_tests_for_section,
    save_marks,
    update_test,
)

can_manage = [role_required("super_admin", "principal", "teacher")]
all_auth = [Depends(get_current_user)]

router = APIRouter(prefix="/class-tests", tags=["class-tests"])


@router.get("", response_model=list[ClassTestResponse], dependencies=all_auth)
async def list_class_tests(section_id: str, db: AsyncSession = Depends(get_db)):
    return await list_tests_for_section(section_id, db)


@router.post("", response_model=ClassTestResponse, dependencies=can_manage)
async def create_class_test(
    body: ClassTestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    test = await create_test(db, body.model_dump(), created_by=current_user["id"])
    return await get_test_with_counts(str(test.id), db)


@router.get("/{test_id}", response_model=ClassTestDetailResponse, dependencies=all_auth)
async def get_class_test(test_id: str, db: AsyncSession = Depends(get_db)):
    return await get_test_detail(test_id, db)


@router.patch("/{test_id}", response_model=ClassTestResponse, dependencies=can_manage)
async def update_class_test(test_id: str, body: ClassTestUpdate, db: AsyncSession = Depends(get_db)):
    await update_test(db, test_id, body.model_dump(exclude_unset=True))
    return await get_test_with_counts(test_id, db)


@router.delete("/{test_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=can_manage)
async def delete_class_test(test_id: str, db: AsyncSession = Depends(get_db)):
    await delete_test(db, test_id)


@router.put("/{test_id}/marks", dependencies=can_manage)
async def update_marks(test_id: str, body: BulkMarksUpdate, db: AsyncSession = Depends(get_db)):
    entries = [{"student_id": str(m.student_id), "marks_obtained": m.marks_obtained} for m in body.marks]
    await save_marks(db, test_id, entries)
    return {"ok": True}