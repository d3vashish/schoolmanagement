// api/homework.js
//
// Rewritten to call your real FastAPI backend (see app/modules/homework/router.py)
// instead of the old Frappe-shaped calls (getList/createDoc from './frappe').
//
// Field mapping notes:
// - "Class" in the UI maps to picking a (section_id, subject_id) pair from
//   the logged-in teacher's own teaching profile (GET /academic/my-teaching-profile),
//   NOT a generic /academic/sections list. A teacher only assigns homework to
//   classes/subjects they actually teach.
// - Google Classroom fields (gc_*, sync_status, sync_error, gc_attempted_at)
//   are intentionally dropped here. The DB columns still exist (no migration
//   run), but this app no longer reads or writes them.

import { apiGet, apiPost, apiPatch, apiDelete } from './fastapi';

export async function getHomeworkList(filters = {}) {
  const params = new URLSearchParams();
  if (filters.sectionId) params.set('section_id', filters.sectionId);
  if (filters.subjectId) params.set('subject_id', filters.subjectId);
  if (filters.status) params.set('status', filters.status);

  const qs = params.toString();
  const items = await apiGet(`/homework${qs ? `?${qs}` : ''}`);

  items.sort(
    (a, b) => new Date(b.assigned_date || b.created_at) - new Date(a.assigned_date || a.created_at)
  );
  return items;
}

export async function getHomeworkDoc(id) {
  return apiGet(`/homework/${id}`);
}

export async function createHomework(data) {
  const payload = {
    title: data.title,
    description: data.description || '',
    subject_id: data.subjectId || null,
    section_id: data.sectionId || null,
    class_name: data.className || '',
    due_date: data.dueDate || null,
    max_points: data.maxPoints != null ? Number(data.maxPoints) : null,
    status: 'Published',
  };
  return apiPost('/homework', payload);
}

export async function updateHomework(id, updates) {
  const mapped = {};
  if (updates.title !== undefined) mapped.title = updates.title;
  if (updates.description !== undefined) mapped.description = updates.description;
  if (updates.subjectId !== undefined) mapped.subject_id = updates.subjectId;
  if (updates.sectionId !== undefined) mapped.section_id = updates.sectionId;
  if (updates.className !== undefined) mapped.class_name = updates.className;
  if (updates.dueDate !== undefined) mapped.due_date = updates.dueDate;
  if (updates.maxPoints !== undefined) mapped.max_points = Number(updates.maxPoints);
  if (updates.status !== undefined) mapped.status = updates.status;

  return apiPatch(`/homework/${id}`, mapped);
}

export async function deleteHomework(id) {
  return apiDelete(`/homework/${id}`);
}

// Used to populate the "Class" dropdown in the Assign form.
// Returns only the classes/sections/subjects the logged-in teacher actually teaches.
export async function getMyTeachingProfile() {
  return apiGet('/academic/my-teaching-profile');
}