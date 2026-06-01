from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.modules.parent.models import ParentStudentLink


async def get_parent_child(
    child_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UUID:
    link = await db.execute(
        select(ParentStudentLink).where(
            ParentStudentLink.parent_id == current_user["id"],
            ParentStudentLink.student_id == child_id,
        )
    )
    if not link.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not your child",
        )
    return child_id
