"""Create initial teacher assignments based on school data."""
import asyncio
from app.core.database import get_db
from app.modules.academic.models import (
    Class, Section, Subject, ClassSubject, TeacherAssignment
)
from app.modules.auth.models import User, StaffProfile
from sqlalchemy import select

TEACHER_SUBJECT_MAP = {
    "Amit Sharma": ["Mathematics"],
    "Priya Verma": ["English"],
    "Sunita Singh": ["Hindi"],
    "Rajesh Kumar": ["Science", "Physics"],
    "Kavita Nair": ["Science"],
    "Neha Gupta": ["Social Studies"],
    "Vikram Patel": ["Chemistry"],
    "Deepak Rao": ["Biology"],
}

async def main():
    async for db in get_db():
        # Load all data
        teachers = {}
        t_result = await db.execute(
            select(User, StaffProfile)
            .join(StaffProfile, StaffProfile.user_id == User.id)
            .where(User.role == "teacher", User.deleted_at.is_(None))
        )
        for user, profile in t_result.all():
            name = f"{profile.first_name} {profile.last_name}"
            teachers[name] = str(user.id)

        sections = {}
        s_result = await db.execute(select(Section))
        for s in s_result.scalars().all():
            sections[str(s.id)] = s

        subjects = {}
        subj_result = await db.execute(select(Subject))
        for s in subj_result.scalars().all():
            subjects[s.name] = str(s.id)

        classes = {}
        c_result = await db.execute(select(Class).order_by(Class.order))
        for c in c_result.scalars().all():
            classes[str(c.id)] = c

        # Get all class-subject links
        cs_result = await db.execute(select(ClassSubject))
        cs_links = set()
        cs_map = {}  # class_id -> set of subject_ids
        for cs in cs_result.scalars().all():
            cid = str(cs.class_id)
            sid = str(cs.subject_id)
            cs_links.add((cid, sid))
            cs_map.setdefault(cid, set()).add(sid)

        # Map subject names to IDs
        subject_name_to_id = {}
        for subj_name, subj_id in subjects.items():
            # Handle Science -> Science for classes 1-5, Physics/Chemistry/Biology for 6-12
            subject_name_to_id[subj_name] = subj_id

        created = 0
        for teacher_name, subject_names in TEACHER_SUBJECT_MAP.items():
            tid = teachers.get(teacher_name)
            if not tid:
                print(f"WARN: Teacher '{teacher_name}' not found")
                continue

            for subj_name in subject_names:
                subj_id = subjects.get(subj_name)
                if not subj_id:
                    print(f"WARN: Subject '{subj_name}' not found")
                    continue

                # For each section, check if this class+subject combo exists
                for sec_id, section in sections.items():
                    cid = str(section.class_id)
                    if cid not in cs_map or subj_id not in cs_map[cid]:
                        continue  # This subject isn't taught in this class

                    existing = await db.execute(
                        select(TeacherAssignment).where(
                            TeacherAssignment.instructor_id == tid,
                            TeacherAssignment.section_id == sec_id,
                            TeacherAssignment.subject_id == subj_id,
                        )
                    )
                    if existing.first():
                        continue  # Already assigned

                    ta = TeacherAssignment(
                        instructor_id=tid,
                        section_id=sec_id,
                        subject_id=subj_id,
                        class_id=cid,
                    )
                    db.add(ta)
                    created += 1

        await db.commit()
        print(f"Created {created} teacher assignments")

        # Summary
        print("\n=== ASSIGNMENT SUMMARY ===")
        ta_result = await db.execute(select(TeacherAssignment))
        all_tas = ta_result.scalars().all()
        by_teacher = {}
        for ta in all_tas:
            by_teacher.setdefault(str(ta.instructor_id), []).append(ta)
        for tid, tas in by_teacher.items():
            t_name = "unknown"
            for tn, tuid in teachers.items():
                if tuid == tid:
                    t_name = tn
                    break
            print(f"  {t_name}: {len(tas)} assignments")

asyncio.run(main())
