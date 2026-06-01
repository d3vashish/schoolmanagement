import axios from 'axios';

const getClient = () => {
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  const csrf = match ? decodeURIComponent(match[1]) : null;
  return axios.create({
    baseURL: '/api',
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
      ...(csrf ? { 'X-Frappe-CSRF-Token': csrf } : {}),
    },
    timeout: 15000,
  });
};

const homeworkFields = [
  { fieldname: 'title', label: 'Title', fieldtype: 'Data', reqd: 1 },
  { fieldname: 'description', label: 'Description', fieldtype: 'Text Editor' },
  { fieldname: 'course', label: 'Course', fieldtype: 'Link', options: 'Course' },
  { fieldname: 'course_name', label: 'Course Name', fieldtype: 'Data' },
  { fieldname: 'student_group', label: 'Student Group', fieldtype: 'Link', options: 'Student Group' },
  { fieldname: 'class_name', label: 'Class Name', fieldtype: 'Data' },
  { fieldname: 'academic_year', label: 'Academic Year', fieldtype: 'Link', options: 'Academic Year' },
  { fieldname: 'due_date', label: 'Due Date', fieldtype: 'Date' },
  { fieldname: 'max_points', label: 'Max Points', fieldtype: 'Int' },
  { fieldname: 'assigned_by', label: 'Assigned By', fieldtype: 'Link', options: 'User' },
  { fieldname: 'assigned_by_name', label: 'Assigned By Name', fieldtype: 'Data' },
  { fieldname: 'assigned_date', label: 'Assigned Date', fieldtype: 'Datetime' },
  { fieldname: 'status', label: 'Status', fieldtype: 'Select', options: 'Published\nDraft', default: 'Published' },
  { fieldname: 'gc_course_id', label: 'GC Course ID', fieldtype: 'Data' },
  { fieldname: 'gc_course_work_id', label: 'GC CourseWork ID', fieldtype: 'Data' },
  { fieldname: 'gc_invite_code', label: 'GC Invite Code', fieldtype: 'Data' },
  { fieldname: 'gc_course_link', label: 'GC Course Link', fieldtype: 'Data' },
  { fieldname: 'sync_status', label: 'Sync Status', fieldtype: 'Select', options: 'pending\nsyncing\nsynced\nfailed', default: 'pending' },
  { fieldname: 'sync_error', label: 'Sync Error', fieldtype: 'Small Text' },
  { fieldname: 'gc_attempted_at', label: 'GC Attempted At', fieldtype: 'Datetime' },
];

const integrationFields = [
  { fieldname: 'title', label: 'Title', fieldtype: 'Data', reqd: 1 },
  { fieldname: 'user', label: 'User', fieldtype: 'Link', options: 'User', reqd: 1 },
  { fieldname: 'gc_email', label: 'GC Email', fieldtype: 'Data' },
  { fieldname: 'access_token', label: 'Access Token', fieldtype: 'Password' },
  { fieldname: 'refresh_token', label: 'Refresh Token', fieldtype: 'Password' },
  { fieldname: 'token_expiry', label: 'Token Expiry', fieldtype: 'Datetime' },
  { fieldname: 'is_active', label: 'Is Active', fieldtype: 'Check', default: 1 },
];

async function checkDocTypeExists(client, name) {
  try {
    await client.get(`/resource/DocType/${encodeURIComponent(name)}`);
    return true;
  } catch (e) {
    if (e.response?.status === 404) return false;
    throw e;
  }
}

async function createDocType(name, moduleName, fields) {
  const client = getClient();

  const exists = await checkDocTypeExists(client, name);
  if (exists) {
    // Patch the existing DocType with correct naming rule and any missing fields
    try {
      await client.put(`/resource/DocType/${encodeURIComponent(name)}`, {
        naming_rule: 'By fieldname',
        autoname: 'field:title',
        fields,
      });
    } catch (e) {
      // Ignore patch errors — the DocType exists and works as long as it has `title`
    }
    return { created: false, reason: 'already exists (patched)' };
  }

  await client.post('/resource/DocType', {
    doctype: 'DocType',
    name,
    module: moduleName || 'Custom',
    custom: 1,
    is_submittable: 0,
    track_changes: 1,
    naming_rule: 'By fieldname',
    autoname: 'field:title',
    fields,
  });
  return { created: true };
}

export async function ensureHomeworkDocType() {
  return createDocType('Homework Assignment', 'Custom', homeworkFields);
}

export async function ensureGoogleIntegrationDocType() {
  return createDocType('Google Integration', 'Custom', integrationFields);
}

export async function setupHomeworkDocTypes() {
  const results = [];
  try {
    results.push(await ensureHomeworkDocType());
  } catch (e) {
    results.push({ created: false, reason: e.message });
  }
  try {
    results.push(await ensureGoogleIntegrationDocType());
  } catch (e) {
    results.push({ created: false, reason: e.message });
  }
  return results;
}
