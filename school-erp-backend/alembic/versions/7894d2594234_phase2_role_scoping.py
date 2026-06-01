"""phase2_role_scoping

Revision ID: 7894d2594234
Revises: f57bc06f51c4
Create Date: 2026-05-27 23:03:14.886082

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '7894d2594234'
down_revision: Union[str, None] = 'f57bc06f51c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('teacher_assignments',
    sa.Column('instructor_id', sa.UUID(), nullable=False),
    sa.Column('section_id', sa.UUID(), nullable=False),
    sa.Column('subject_id', sa.UUID(), nullable=False),
    sa.Column('class_id', sa.UUID(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['class_id'], ['academic_classes.id'], ),
    sa.ForeignKeyConstraint(['instructor_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['section_id'], ['academic_sections.id'], ),
    sa.ForeignKeyConstraint(['subject_id'], ['academic_subjects.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('instructor_id', 'section_id', 'subject_id', name='uq_teacher_assignment')
    )
    op.create_index(op.f('ix_teacher_assignments_instructor_id'), 'teacher_assignments', ['instructor_id'], unique=False)
    op.create_index(op.f('ix_teacher_assignments_section_id'), 'teacher_assignments', ['section_id'], unique=False)
    op.create_index(op.f('ix_teacher_assignments_subject_id'), 'teacher_assignments', ['subject_id'], unique=False)
    op.add_column('academic_sections', sa.Column('class_teacher_id', sa.UUID(), nullable=True))
    op.create_foreign_key(None, 'academic_sections', 'users', ['class_teacher_id'], ['id'])
    op.add_column('student_profiles', sa.Column('section_id', sa.UUID(), nullable=True))
    op.create_foreign_key(None, 'student_profiles', 'academic_sections', ['section_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint(None, 'student_profiles', type_='foreignkey')
    op.drop_column('student_profiles', 'section_id')
    op.drop_constraint(None, 'academic_sections', type_='foreignkey')
    op.drop_column('academic_sections', 'class_teacher_id')
    op.drop_index(op.f('ix_teacher_assignments_subject_id'), table_name='teacher_assignments')
    op.drop_index(op.f('ix_teacher_assignments_section_id'), table_name='teacher_assignments')
    op.drop_index(op.f('ix_teacher_assignments_instructor_id'), table_name='teacher_assignments')
    op.drop_table('teacher_assignments')
