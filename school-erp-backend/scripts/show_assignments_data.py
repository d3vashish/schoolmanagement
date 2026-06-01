import asyncio
from app.core.database import get_db
from app.modules.academic.models import Class, Section, Subject, ClassSubject
from app.modules.auth.models import User, StaffProfile
from sqlalchemy import select

async def main():
    async for db in get_db():
        print("=== TEACHERS ===")
        t_result = await db.execute(select(User).where(User.role == "teacher", User.deleted_at.is_(None)))
        teachers = t_result.scalars().all()
        for t in teachers:
            sp = await db.execute(select(StaffProfile).where(StaffProfile.user_id == t.id))
            sp = sp.scalar_one_or_none()
            name = f"{sp.first_name} {sp.last_name}" if sp else t.email
            print(f"  {t.id} | {name} | {t.email}")

        print("\n=== CLASSES ===")
        c_result = await db.execute(select(Class).order_by(Class.order))
        classes = {str(c.id): c for c in c_result.scalars().all()}
        for cid, c in classes.items():
            print(f"  {cid} | {c.name} (order: {c.order})")

        print("\n=== SECTIONS (grouped by class) ===")
        s_result = await db.execute(select(Section).order_by(Section.name))
        sections = s_result.scalars().all()
        sections_by_class = {}
        for s in sections:
            cid = str(s.class_id)
            sections_by_class.setdefault(cid, []).append(s)
        for cid, secs in sections_by_class.items():
            cname = classes.get(cid, Class(name="?")).name
            for s in secs:
                print(f"  Section: {s.id} | class={cname} | name={s.name} | capacity={s.capacity}")

        print("\n=== SUBJECTS ===")
        subj_result = await db.execute(select(Subject).order_by(Subject.name))
        subjects = subj_result.scalars().all()
        for s in subjects:
            print(f"  {s.id} | {s.name} (code: {s.code})")

        print("\n=== CLASS-SUBJECT LINKS ===")
        cs_result = await db.execute(select(ClassSubject))
        cs_links = cs_result.scalars().all()
        for cs in cs_links:
            cname = classes.get(str(cs.class_id), Class(name="?")).name
            print(f"  class={cname} | subject_id={cs.subject_id}")

        print("\n=== CURRENT TEACHER ASSIGNMENTS ===")
        from app.modules.academic.models import TeacherAssignment
        ta_result = await db.execute(select(TeacherAssignment))
        tas = ta_result.scalars().all()
        print(f"  Count: {len(tas)}")
        for ta in tas:
            print(f"  instructor={ta.instructor_id} section={ta.section_id} subject={ta.subject_id} class={ta.class_id}")

        break

asyncio.run(main())
