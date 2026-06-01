import { getList, getDoc, createDoc, updateDoc, deleteDoc } from './frappe';

const DOCTYPE = 'Homework Assignment';

export async function getHomeworkList(filters = {}) {
  const filterArr = [];
  if (filters.studentGroup) filterArr.push(['student_group', '=', filters.studentGroup]);
  if (filters.courseId) filterArr.push(['course', '=', filters.courseId]);
  if (filters.assignedBy) filterArr.push(['assigned_by', '=', filters.assignedBy]);
  if (filters.status) filterArr.push(['status', '=', filters.status]);

  const items = await getList(DOCTYPE, filterArr, [
    'name', 'title', 'description', 'course', 'course_name',
    'student_group', 'class_name', 'academic_year', 'due_date',
    'max_points', 'assigned_by', 'assigned_by_name', 'assigned_date',
    'status', 'gc_course_id', 'gc_course_work_id', 'gc_invite_code',
    'gc_course_link', 'sync_status', 'sync_error', 'gc_attempted_at',
    'creation',
  ], 200);

  items.sort((a, b) => new Date(b.assigned_date || b.creation) - new Date(a.assigned_date || a.creation));
  return items;
}

export async function getHomeworkDoc(name) {
  return getDoc(DOCTYPE, name);
}

export async function createHomework(data) {
  const doc = {
    title: data.title,
    description: data.description || '',
    course: data.courseId || '',
    course_name: data.courseName || '',
    student_group: data.studentGroup || '',
    class_name: data.className || '',
    academic_year: data.academicYear || '',
    due_date: data.dueDate || '',
    max_points: data.maxPoints != null ? Number(data.maxPoints) : null,
    assigned_by: data.assignedBy || '',
    assigned_by_name: data.assignedByName || '',
    assigned_date: new Date().toISOString().slice(0, 10),
    status: 'Published',
    sync_status: 'pending',
  };
  return createDoc(DOCTYPE, doc);
}

export async function updateHomework(name, updates) {
  const mapped = {};
  if (updates.title !== undefined) mapped.title = updates.title;
  if (updates.description !== undefined) mapped.description = updates.description;
  if (updates.courseId !== undefined) mapped.course = updates.courseId;
  if (updates.courseName !== undefined) mapped.course_name = updates.courseName;
  if (updates.studentGroup !== undefined) mapped.student_group = updates.studentGroup;
  if (updates.className !== undefined) mapped.class_name = updates.className;
  if (updates.dueDate !== undefined) mapped.due_date = updates.dueDate;
  if (updates.maxPoints !== undefined) mapped.max_points = Number(updates.maxPoints);
  if (updates.status !== undefined) mapped.status = updates.status;
  if (updates.gcCourseId !== undefined) mapped.gc_course_id = updates.gcCourseId;
  if (updates.gcCourseWorkId !== undefined) mapped.gc_course_work_id = updates.gcCourseWorkId;
  if (updates.gcInviteCode !== undefined) mapped.gc_invite_code = updates.gcInviteCode;
  if (updates.gcCourseLink !== undefined) mapped.gc_course_link = updates.gcCourseLink;
  if (updates.syncStatus !== undefined) mapped.sync_status = updates.syncStatus;
  if (updates.syncError !== undefined) mapped.sync_error = updates.syncError;
  if (updates.gcAttemptedAt !== undefined) mapped.gc_attempted_at = updates.gcAttemptedAt;

  return updateDoc(DOCTYPE, name, mapped);
}

export async function deleteHomework(name) {
  return deleteDoc(DOCTYPE, name);
}
