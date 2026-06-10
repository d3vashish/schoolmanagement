import { client } from './frappe';

const BASE = '/timetable/slots';

export async function listSlots(params) {
  const res = await client.get(BASE, { params });
  let items = res.data;
  if (!Array.isArray(items)) items = items.data || items.results || [];
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return items.map(s => ({
    id: s.id || s.name,
    section_id: s.section_id,
    subject_id: s.subject_id,
    instructor_id: s.instructor_id,
    day_of_week: typeof s.day_of_week === 'number' ? s.day_of_week : 0,
    period_no: s.period_no,
    subject_name: s.subject_name || s.course_name || '',
    instructor_name: s.instructor_name || '',
    is_published: s.is_published || false,
  }));
}

export async function getSlot(id) {
  const res = await client.get(`${BASE}/${id}`);
  return res.data;
}

export async function createSlot(data) {
  const res = await client.post(BASE, data);
  return res.data;
}

export async function updateSlot(id, data) {
  const res = await client.patch(`${BASE}/${id}`, data);
  return res.data;
}

export async function publishSlot(id) {
  await client.post(`${BASE}/${id}/publish`);
}

export async function deleteSlot(id) {
  await client.delete(`${BASE}/${id}`);
}
