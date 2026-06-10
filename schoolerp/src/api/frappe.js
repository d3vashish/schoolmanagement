import axios from 'axios';

const BASE = '/api';

// ─── JWT Token Management ────────────────────────────────────────────────────
let accessToken = null;
let refreshToken = null;

export function setTokens(access, refresh) {
  accessToken = access;
  refreshToken = refresh;
  if (access) {
    sessionStorage.setItem('erp_access_token', access);
    sessionStorage.setItem('erp_refresh_token', refresh || '');
  } else {
    sessionStorage.removeItem('erp_access_token');
    sessionStorage.removeItem('erp_refresh_token');
  }
}

export function loadTokens() {
  accessToken = sessionStorage.getItem('erp_access_token');
  refreshToken = sessionStorage.getItem('erp_refresh_token');
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  sessionStorage.removeItem('erp_access_token');
  sessionStorage.removeItem('erp_refresh_token');
}

export function getAccessToken() { return accessToken; }

loadTokens();

// ─── Axios Client ─────────────────────────────────────────────────────────────
export const client = axios.create({
  baseURL: BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

client.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && refreshToken) {
      original._retry = true;
      try {
        const res = await axios.post(`${BASE}/auth/refresh`, { refresh_token: refreshToken });
        const { access_token, refresh_token } = res.data;
        setTokens(access_token, refresh_token);
        original.headers.Authorization = `Bearer ${access_token}`;
        return client(original);
      } catch { /* refresh failed */ }
    }
    return Promise.reject(error);
  }
);

// ─── Error Parsing ────────────────────────────────────────────────────────────
export const parseFrappeError = (error) => {
  try {
    const status = error.response?.status;
    const data = error.response?.data;
    if (!error.response) return error.message || 'Something went wrong';
    if (data?.detail) return data.detail;
    if (data?.message) return data.message;
    if (status === 500) return 'Server error';
    if (status === 403) return 'Permission denied';
    if (status === 401) return 'Session expired. Please log in again.';
    if (status === 404) return 'Resource not found.';
    return error.message || 'Something went wrong';
  } catch { return error.message || 'Something went wrong'; }
};

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const login = async (usr, pwd) => {
  const res = await client.post('/auth/login', { email: usr, password: pwd });
  const { access_token, refresh_token, user_id, role } = res.data;
  setTokens(access_token, refresh_token);
  return { message: 'Logged In', ...res.data };
};

export const logout = async () => {
  try {
    if (refreshToken) {
      await client.post('/auth/logout', { refresh_token: refreshToken });
    }
  } catch { /* ignore */ }
  clearTokens();
};

export const getLoggedUser = async () => {
  const res = await client.get('/auth/me');
  return res.data.email;
};

export const checkUserExists = async (email) => {
  try {
    await client.get(`/auth/me`);
    return true;
  } catch { return false; }
};

// ─── Doctype-to-Endpoint Mapping ─────────────────────────────────────────────

const DOC_ENDPOINTS = {
  'Academic Year':           { list: '/academic/years',            single: '/academic/years/{name}',         method: null },
  'Program':                 { list: '/academic/classes',          single: '/academic/classes/{name}',        method: null },
  'Student Group':           { list: '/academic/sections',         single: '/academic/sections/{name}',       method: null },
  'Course':                  { list: '/academic/subjects',         single: '/academic/subjects/{name}',       method: null },
  'Student Attendance':      { list: null,                         single: null,                              method: null },
  'Student':                 { list: '/academic/students',         single: '/academic/students/{name}',       method: null },
  'Instructor':              { list: '/academic/instructors',      single: '/academic/instructors/{name}',    method: null },
  'User':                    { list: '/auth/users',                single: '/auth/users/{name}',              method: null },
  'Homework Assignment':     { list: '/homework',                   single: '/homework/{name}',                 method: null },
  'Fee Structure':           { list: '/fees/structures',           single: '/fees/structures/{name}',         method: null },
  'Fee Category':            { list: '/fees/heads',                single: '/fees/heads/{name}',              method: null },
  'Fees':                    { list: '/fees/invoices',             single: '/fees/invoices/{name}',           method: null },
  'Fee Schedule':            { list: null,                         single: null,                              method: null },
  'Payment Entry':           { list: '/fees/orders',               single: '/fees/orders/{name}',             method: null },
  'Program Enrollment':      { list: '/academic/enrollments',      single: null,                              method: null },
  'Leave Application':       { list: '/attendance/leaves',         single: '/attendance/leaves/{name}',       method: null },
  'Student Guardian':        { list: null,                         single: null,                              method: null },
  'Salary Slip':             { list: null,                         single: null,                              method: null },
  'Account':                 { list: '/fees/accounts',             single: null,                              method: null },
  'Assessment Plan':         { list: null,                         single: null,                              method: null },
  'Student Group Instructor':{ list: null,                         single: null,                              method: null },
  'Mode of Payment':         { list: '/fees/payment-modes',        single: null,                              method: null },
  'Employee':                { list: null,                         single: null,                              method: null },
  'Accountant':              { list: null,                         single: null,                              method: null },
  'Attendance':              { list: null,                         single: null,                              method: null },
  'System Settings':         { list: null,                         single: null,                              method: null },
  'Education Settings':      { list: null,                         single: null,                              method: null },
};

function urlFor(doctype, endpointType, name) {
  const ep = DOC_ENDPOINTS[doctype];
  if (!ep || !ep[endpointType]) return null;
  return ep[endpointType].replace('{name}', encodeURIComponent(name || ''));
}

// ─── Field Transformation ─────────────────────────────────────────────────────

function fieldsToMap(fields) {
  if (!fields || fields.length === 1 && fields[0] === 'name') return {};
  const m = {};
  const snake = (s) => s.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
  fields.forEach(f => { m[snake(f)] = true; });
  return m;
}

function pick(obj, fields) {
  if (!fields || fields.length === 0 || fields[0] === '*') return obj;
  const result = {};
  const snake = (s) => s.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
  fields.forEach(f => { result[f] = obj[snake(f)] ?? obj[f] ?? ''; });
  return result;
}

// ─── Generic Helpers ──────────────────────────────────────────────────────────

async function fetchList(doctype, url, filters, fields, pageLength, pageStart) {
  if (!url) return [];
  try {
    const params = { limit: pageLength || 100, offset: pageStart || 0 };
    const res = await client.get(url, { params });
    let items = res.data;
    if (!Array.isArray(items)) items = items.data || items.results || [];
    return items.map(item => pick(item, fields));
  } catch { return []; }
}

async function fetchDoc(doctype, url, name) {
  if (!url) {
    // Return a minimal stub so pages don't crash
    return { name: name || 'stub', doctype };
  }
  try {
    const res = await client.get(url);
    return res.data.data || res.data;
  } catch { return { name: name || 'stub', doctype }; }
}

// ─── Doctype-specific Handlers ────────────────────────────────────────────────

const HANDLERS = {
  // ── Academic Year ──
  'Academic Year': {
    async list(filters, fields, pageLength, pageStart) {
      const url = urlFor('Academic Year', 'list');
      return fetchList('Academic Year', url, filters, fields, pageLength, pageStart);
    },
    async get(name) {
      const url = urlFor('Academic Year', 'single', name);
      return fetchDoc('Academic Year', url, name);
    },
    async create(data) {
      const res = await client.post('/academic/years', {
        name: data.academic_year_name || data.name,
        start_date: data.year_start_date,
        end_date: data.year_end_date,
        is_active: true,
      });
      return { name: res.data.id || res.data.name, ...res.data };
    },
  },

  // ── Program → Class ──
  'Program': {
    async list(filters, fields, pageLength, pageStart) {
      const url = urlFor('Program', 'list');
      let items = await fetchList('Program', url, filters, ['id', 'name', 'order', ...fields], pageLength, pageStart);
      return items.map(c => ({
        name: c.id || c.name,
        program_name: c.name || c.id,
        ...pick(c, fields),
      }));
    },
    async get(name) {
      const url = urlFor('Program', 'single', name);
      try {
        const res = await client.get(url);
        const c = res.data.data || res.data;
        return { name: c.id || name, program_name: c.name || name, doctype: 'Program' };
      } catch { return { name, program_name: name, doctype: 'Program' }; }
    },
    async create(data) {
      const res = await client.post('/academic/classes', {
        name: data.program_name || data.name,
        order: data.order || 0,
      });
      return { name: res.data.id || res.data.name, program_name: data.program_name || data.name };
    },
    async update(name, data) {
      const res = await client.patch(`/academic/classes/${name}`, {
        name: data.program_name || data.name,
        order: data.order,
      });
      return { name, ...data };
    },
  },

  // ── Student Group → Section ──
  'Student Group': {
    async list(filters, fields, pageLength, pageStart) {
      const url = urlFor('Student Group', 'list');
      let items = await fetchList('Student Group', url, filters, ['id', 'name', 'class_id', 'capacity', 'academic_year_id', 'program', 'academic_year', ...fields], pageLength, pageStart);
      return items.map(s => ({
        ...pick(s, fields),
        name: s.id || s.name,
        student_group_name: s.program && s.name ? `${s.program} - ${s.name}` : (s.name || s.id),
        program: s.program || s.class_id || '',
        academic_year: s.academic_year || s.academic_year_id || '',
        class_teacher: s.class_teacher || '',
        group_based_on: 'Batch',
        max_strength: s.capacity || '',
        students: s.students || [],
      }));
    },
    async get(name) {
      const url = urlFor('Student Group', 'single', name);
      let item = await fetchDoc('Student Group', url, name);
      const students = (item.students || []).map(st => ({
        student: st.id || st.student || st.user_id || '',
        student_name: st.student_name || `${st.first_name || ''} ${st.last_name || ''}`.trim() || st.email || '',
        active: st.is_active ?? (st.active ?? 1),
      }));
      return {
        name: item.id || item.name || name,
        student_group_name: item.program && item.name ? `${item.program} - ${item.name}` : (item.name || name),
        program: item.program || item.class_id || '',
        academic_year: item.academic_year || item.academic_year_id || '',
        students,
        class_teacher: item.class_teacher || '',
        group_based_on: 'Batch',
        max_strength: item.capacity || '',
      };
    },
    async create(data) {
      const res = await client.post('/academic/sections', {
        class_id: data.program,
        name: (data.student_group_name || data.name || '').split(' - ').pop() || data.name,
        capacity: data.max_strength ? parseInt(data.max_strength) : undefined,
        academic_year_id: data.academic_year || '',
      });
      return { name: res.data.id || res.data.name, ...data };
    },
    async update(name, data) {
      const res = await client.patch(`/academic/sections/${name}`, {
        class_id: data.program,
        name: (data.student_group_name || data.name || '').split(' - ').pop() || data.name,
        capacity: data.max_strength ? parseInt(data.max_strength) : undefined,
        academic_year_id: data.academic_year || '',
      });
      return { name, ...data };
    },
  },

  // ── Course → Subject ──
  'Course': {
    async list(filters, fields, pageLength, pageStart) {
      const url = urlFor('Course', 'list');
      let items = await fetchList('Course', url, filters, ['id', 'name', 'code', 'is_graded', ...fields], pageLength, pageStart);
      return items.map(s => ({
        ...pick(s, fields),
        id: s.id,
        name: s.id || s.name,
        course_name: s.name || s.id,
        course_code: s.code || '',
        is_graded: s.is_graded ?? true,
      }));
    },
    async get(name) {
      const url = urlFor('Course', 'single', name);
      let item = await fetchDoc('Course', url, name);
      return { name: item.id || item.name || name, course_name: item.name || name, course_code: item.code || '', is_graded: item.is_graded ?? true };
    },
    async create(data) {
      const res = await client.post('/academic/subjects', {
        name: data.course_name || data.name,
        code: data.course_code || '',
        is_graded: data.is_graded ?? true,
      });
      return { name: res.data.id || res.data.name, course_name: data.course_name || data.name };
    },
    async update(name, data) {
      const res = await client.patch(`/academic/subjects/${name}`, {
        name: data.course_name || data.name,
        code: data.course_code,
        is_graded: data.is_graded,
      });
      return { name, ...data };
    },
  },

  // ── Student Attendance ──
  'Student Attendance': {
    async list(filters, fields, pageLength, pageStart) {
      const studentId = filters?.find(f => f[0] === 'student')?.[2];
      const group = filters?.find(f => f[0] === 'student_group')?.[2];
      const dateEq = filters?.find(f => f[0] === 'date' && f[1] === '=')?.[2];
      const dateBetween = filters?.find(f => f[0] === 'date' && f[1] === 'between')?.[2];

      if (studentId) {
        try {
          const start = dateBetween?.[0] || dateEq || new Date().toISOString().split('T')[0];
          const end = dateBetween?.[1] || dateEq || start;
          const res = await client.get(`/attendance/student/${studentId}`, { params: { start, end } });
          return (res.data || []).map(a => ({
            name: a.id,
            student: a.student_id,
            student_name: a.student_name || '',
            student_group: group || '',
            status: a.status,
            date: a.date,
          }));
        } catch { return []; }
      }

      if (group && dateEq) {
        try {
          const res = await client.get('/attendance/by-section', { params: { section_id: group, date: dateEq } });
          return (res.data || []).map(a => ({
            name: a.id,
            student: a.student_id,
            student_name: a.student_name || '',
            student_group: group || '',
            status: a.status,
            date: a.date,
          }));
        } catch { return []; }
      }

      if (group && dateBetween) {
        try {
          const res = await client.get('/attendance/overview', { params: { start: dateBetween[0], end: dateBetween[1] } });
          return (res.data || []).map(a => ({
            name: a.id,
            student: a.student_id,
            student_name: a.student_name || '',
            student_group: a.student_group || group || '',
            status: a.status,
            date: a.date,
          }));
        } catch { return []; }
      }
      return [];
    },
    async create(data) {
      try {
        const res = await client.post('/attendance/mark', {
          student_id: data.student,
          date: data.date,
          status: data.status,
        });
        return { name: res.data.id || `att-${Date.now()}`, ...res.data };
      } catch (err) {
        if (err.response?.status === 403) {
          return { name: `att-${Date.now()}`, student: data.student, status: data.status, date: data.date };
        }
        throw err;
      }
    },
    async update(name, data) {
      try {
        const res = await client.patch(`/attendance/mark/${name}`, { student_id: '', date: '', status: data.status });
        return { name, ...res.data };
      } catch { return { name, ...data }; }
    },
  },

  // ── Student ──
  'Student': {
    async list(filters, fields, pageLength, pageStart) {
      const url = urlFor('Student', 'list');
      let items = await fetchList('Student', url, filters, ['id', 'user_id', 'first_name', 'last_name', 'email', 'admission_number', 'class_id', 'student_group_name', 'is_active', 'creation', 'guardian_name', 'guardian_phone', 'address', ...(fields || [])], pageLength, pageStart);
      return items.map(s => ({
        name: s.id || s.name,
        id: s.id,
        first_name: s.first_name || '',
        last_name: s.last_name || '',
        student_name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.email || s.name,
        student_email_id: s.email || '',
        student_mobile_number: '',
        enabled: s.is_active ? 1 : 0,
        date_of_birth: s.date_of_birth || '',
        gender: '',
        student_group: s.student_group_name || s.class_id || '',
        guardians: s.guardian_name ? [{ guardian: s.guardian_name, mobile: s.guardian_phone }] : [],
        ...pick(s, fields),
      }));
    },
    async get(name) {
      const url = urlFor('Student', 'single', name);
      try {
        const res = await client.get(url);
        const s = res.data.data || res.data;
        return {
          name: s.id || name,
          id: s.id,
          user_id: s.user_id || '',
          first_name: s.first_name || '',
          last_name: s.last_name || '',
          student_name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.email || name,
          student_email_id: s.email || '',
          student_mobile_number: '',
          enabled: s.is_active ? 1 : 0,
          date_of_birth: s.date_of_birth || '',
          gender: '',
          student_group: s.student_group_name || s.section_id || s.class_id || '',
          guardians: s.guardian_name ? [{ guardian: s.guardian_name, mobile: s.guardian_phone }] : [],
          address: s.address || '',
          admission_number: s.admission_number || '',
        };
      } catch { return { name, first_name: name, last_name: '', student_name: name, enabled: 1 }; }
    },
    async create(data) {
      const res = await client.post('/academic/students', {
        first_name: data.first_name || data.student_name?.split(' ')[0] || '',
        last_name: data.last_name || data.student_name?.split(' ').slice(1).join(' ') || '',
        email: data.student_email_id || data.email || `${Date.now()}@temp.school`,
        password: 'password123',
        date_of_birth: data.date_of_birth || null,
        class_id: data.student_group || data.class || null,
        guardian_name: data.guardian_name || null,
        guardian_phone: data.guardian_phone || null,
        address: data.address || null,
      });
      return { name: res.data.id || `STU-${Date.now()}`, ...data };
    },
    async update(name, data) {
      const res = await client.patch(`/academic/students/${name}`, {
        first_name: data.first_name,
        last_name: data.last_name,
        date_of_birth: data.date_of_birth,
        class_id: data.student_group || data.class,
        guardian_name: data.guardian_name,
        guardian_phone: data.guardian_phone,
        address: data.address,
        is_active: data.enabled !== undefined ? (data.enabled === 1) : undefined,
      });
      return { name, ...data };
    },
    async delete(name) {
      await client.delete(`/academic/students/${name}`);
    },
  },

  // ── Instructor ──
  'Instructor': {
    async list(filters, fields, pageLength, pageStart) {
      const url = urlFor('Instructor', 'list');
      let items = await fetchList('Instructor', url, filters, ['id', 'user_id', 'email', 'first_name', 'last_name', 'employee_id', 'department', 'qualification', 'is_active', ...(fields || [])], pageLength, pageStart);
      return items.map(i => ({
        ...pick(i, fields),
        id: i.id,
        name: i.user_id || i.id || i.name,
        instructor_name: `${i.first_name || ''} ${i.last_name || ''}`.trim() || i.email || i.name,
        email: i.email || '',
        employee_id: i.employee_id || '',
        department: i.department || '',
        qualification: i.qualification || '',
        enabled: i.is_active ? 1 : 0,
      }));
    },
    async get(name) {
      const url = urlFor('Instructor', 'single', name);
      try {
        const res = await client.get(url);
        const i = res.data.data || res.data;
        const userId = i.user_id || name;
        return {
          name: userId,
          instructor_name: `${i.first_name || ''} ${i.last_name || ''}`.trim() || i.email || name,
          email: i.email || '',
          user: userId,
          employee_id: i.employee_id || '',
          department: i.department || '',
          qualification: i.qualification || '',
          enabled: i.is_active ? 1 : 0,
          doctype: 'Instructor',
        };
      } catch { return { name, instructor_name: name, user: name, doctype: 'Instructor' }; }
    },
    async create(data) {
      const res = await client.post('/academic/instructors', {
        first_name: data.first_name || data.instructor_name?.split(' ')[0] || '',
        last_name: data.last_name || data.instructor_name?.split(' ').slice(1).join(' ') || '',
        email: data.email || `${Date.now()}@temp.school`,
        password: 'password123',
        employee_id: data.employee_id || null,
        department: data.department || null,
        qualification: data.qualification || null,
      });
      return { name: res.data.user_id || `INS-${Date.now()}`, ...data };
    },
    async update(name, data) {
      const res = await client.patch(`/academic/instructors/${name}`, {
        first_name: data.first_name,
        last_name: data.last_name,
        employee_id: data.employee_id,
        department: data.department,
        qualification: data.qualification,
        is_active: data.enabled !== undefined ? (data.enabled === 1) : undefined,
      });
      return { name, ...data };
    },
  },

  // ── User ──
  'User': {
    async list(filters, fields, pageLength, pageStart) {
      const url = urlFor('User', 'list');
      const roleFilter = filters?.find(f => f[1] === 'like' && f[0] === 'role');
      const hasRoleFilter = filters?.find(f => f[0] === 'Has Role');
      const params = { limit: pageLength || 100, offset: pageStart || 0 };
      if (roleFilter) params.role = roleFilter[2];
      if (hasRoleFilter) params.role = hasRoleFilter[2]?.toLowerCase?.() || hasRoleFilter[2];
      try {
        const res = await client.get(url, { params });
        let items = res.data;
        if (!Array.isArray(items)) items = items.data || items.results || [];
        return items.map(u => ({
          name: u.email || u.id || u.name,
          email: u.email || '',
          full_name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || u.name,
          role: u.role || 'User',
          enabled: u.is_active ? 1 : 0,
          ...pick(u, fields),
        }));
      } catch { return []; }
    },
    async get(name) {
      const url = urlFor('User', 'single', name);
      try {
        const res = await client.get(url);
        const u = res.data.data || res.data;
        return {
          name: u.email || name,
          email: u.email || name,
          full_name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || name,
          first_name: u.first_name || '',
          last_name: u.last_name || '',
          enabled: u.is_active ? 1 : 0,
          role: u.role || 'User',
          roles: [{ role: u.role || 'User' }],
          phone: u.phone || '',
        };
      } catch { return { name, email: name, full_name: name, enabled: 1, roles: [{ role: 'User' }] }; }
    },
    async create(data) {
      const res = await client.post('/auth/users', {
        email: data.email || data.name || `${Date.now()}@temp.school`,
        password: data.new_password || 'password123',
        role: (data.role || 'student').toLowerCase(),
        first_name: data.first_name || data.full_name?.split(' ')[0] || data.email?.split('@')[0] || '',
        last_name: data.last_name || data.full_name?.split(' ').slice(1).join(' ') || '',
        phone: data.phone || data.mobile_no || null,
      });
      return { name: res.data.email || data.email, ...data };
    },
    async update(name, data) {
      const res = await client.patch(`/auth/users/${name}`, {
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone || data.mobile_no,
        is_active: data.enabled !== undefined ? (data.enabled === 1) : undefined,
        role: data.role ? data.role.toLowerCase() : undefined,
      });
      return { name: data.email || name, ...data };
    },
    async delete(name) {
      await client.delete(`/auth/users/${name}`);
    },
  },

  // REMOVED: 'Course Schedule' → use api/timetable.js directly

  // ── Fee Structure ──
  'Fee Structure': {
    async list(filters, fields, pageLength, pageStart) {
      const url = urlFor('Fee Structure', 'list');
      let items = await fetchList('Fee Structure', url, filters, ['id', 'academic_year_id', 'class_id', 'fee_head_id', 'amount', ...fields], pageLength, pageStart);
      return items.map(fs => ({
        name: fs.id || fs.name,
        academic_year: fs.academic_year_id || '',
        program: fs.class_id || '',
        fee_category: fs.fee_head_id || '',
        amount: fs.amount || 0,
        ...pick(fs, fields),
      }));
    },
    async get(name) {
      const url = urlFor('Fee Structure', 'single', name);
      let item = await fetchDoc('Fee Structure', url, name);
      return { name: item.id || name, academic_year: item.academic_year_id || '', program: item.class_id || '', fee_category: item.fee_head_id || '', amount: item.amount || 0, ...item };
    },
    async create(data) {
      const res = await client.post('/fees/structures', {
        class_id: data.class_id || data.program || '',
        fee_head_id: data.fee_head_id || '',
        academic_year_id: data.academic_year || '',
        amount: data.amount || 0,
      });
      return { name: res.data.id || `FS-${Date.now()}`, ...data };
    },
    async update(name, data) {
      const res = await client.patch(`/fees/structures/${name}`, {
        academic_year_id: data.academic_year || '',
        class_id: data.class_id || data.program || '',
        fee_head_id: data.fee_head_id || data.fee_category || '',
        amount: data.amount || 0,
      });
      return { name, ...data };
    },
  },

  // ── Fee Category → Fee Head ──
  'Fee Category': {
    async list(filters, fields, pageLength, pageStart) {
      const url = urlFor('Fee Category', 'list');
      return fetchList('Fee Category', url, filters, fields, pageLength, pageStart);
    },
    async get(name) {
      const url = urlFor('Fee Category', 'single', name);
      return fetchDoc('Fee Category', url, name);
    },
    async create(data) {
      const res = await client.post('/fees/heads', {
        name: data.fee_category_name || data.name || data.fee_category || 'Fee',
        is_taxable: false,
        tax_percent: 0,
      });
      return { name: res.data.id || res.data.name, ...data };
    },
  },

  // ── Fee Schedule (batch invoice generation) ──
  'Fee Schedule': {
    async list() { return []; },
    async get(name) { return { name, doctype: 'Fee Schedule' }; },
    async create(data) {
      const studentGroups = data.student_groups || [];
      const studentIds = [];
      for (const g of studentGroups) {
        try {
          const groupName = g.student_group || g;
          const res = await client.get(`/academic/sections/${groupName}`);
          const section = res.data.data || res.data;
          const students = section.students || [];
          students.forEach(s => {
            const sid = s.student_id || s.student || s.id;
            if (sid && !studentIds.includes(sid)) studentIds.push(sid);
          });
        } catch { /* skip */ }
      }
      if (studentIds.length > 0) {
        try {
          await client.post('/fees/invoices/bulk-generate', { student_ids: studentIds, due_date: data.due_date });
        } catch { /* ignore */ }
      }
      return { name: `FSCH-${Date.now()}`, ...data };
    },
    async update(name, data) { return { name, ...data }; },
  },

  // ── Fees → Invoice ──
  'Fees': {
    async list(filters, fields, pageLength, pageStart) {
      const url = urlFor('Fees', 'list');
      return fetchList('Fees', url, filters, fields, pageLength, pageStart);
    },
    async get(name) {
      const url = urlFor('Fees', 'single', name);
      let item = await fetchDoc('Fees', url, name);
      return {
        name: item.id || name,
        student: item.student_id || '',
        student_name: item.student_name || '',
        gross_amount: item.gross_amount || item.net_amount || 0,
        net_amount: item.net_amount || 0,
        discount_amount: item.discount_amount || 0,
        due_date: item.due_date || '',
        status: item.status || 'Unpaid',
        paid_at: item.paid_at || null,
      };
    },
    async create(data) {
      const studentId = data.student || data.student_id || '';
      if (studentId) {
        try {
          await client.post(`/fees/invoices/generate/${studentId}`);
        } catch { /* ignore */ }
      }
      return { name: `INV-${Date.now()}`, ...data };
    },
    async update(name, data) {
      return { name, ...data };
    },
  },

  // ── Leave Application ──
  'Leave Application': {
    async list(filters, fields, pageLength, pageStart) {
      const studentFilter = filters?.find(f => f[0] === 'student')?.[2];
      const url = urlFor('Leave Application', 'list');
      const params = { limit: pageLength || 100, offset: pageStart || 0 };
      if (studentFilter) params.student_id = studentFilter;
      try {
        const res = await client.get(url, { params });
        let items = res.data;
        if (!Array.isArray(items)) items = items.data || items.results || [];
        return items.map(l => ({
          name: l.id || l.name,
          student: l.student_id || '',
          leave_type: l.leave_type_id || '',
          from_date: l.start_date || '',
          to_date: l.end_date || '',
          reason: l.reason || '',
          status: l.status || 'Open',
          ...pick(l, fields),
        }));
      } catch { return []; }
    },
    async get(name) {
      const url = urlFor('Leave Application', 'single', name);
      try {
        const res = await client.get(url);
        const l = res.data.data || res.data;
        return { name: l.id || name, student: l.student_id || '', status: l.status || 'Open', leave_type: l.leave_type_id || '', from_date: l.start_date || '', to_date: l.end_date || '', reason: l.reason || '' };
      } catch { return { name, doctype: 'Leave Application' }; }
    },
  },

  // ── Program Enrollment ──
  'Program Enrollment': {
    async list(filters, fields, pageLength, pageStart) {
      const studentFilter = filters?.find(f => f[0] === 'student')?.[2];
      const url = urlFor('Program Enrollment', 'list');
      const params = { limit: pageLength || 100, offset: pageStart || 0 };
      if (studentFilter) params.student_id = studentFilter;
      try {
        const res = await client.get(url, { params });
        let items = res.data;
        if (!Array.isArray(items)) items = items.data || items.results || [];
        return items.map(e => ({
          name: e.id || e.name,
          student: e.student_id || '',
          program: e.class_name || e.class_id || '',
          academic_year: e.academic_year_name || '',
          enrollment_date: e.enrollment_date || '',
          ...pick(e, fields),
        }));
      } catch { return []; }
    },
    async get(name) { return { name, doctype: 'Program Enrollment' }; },
    async create(data) {
      try {
        const res = await client.post('/academic/enrollments', {
          student_id: data.student || data.student_id || '',
          class_id: data.program || data.class_id || '',
          academic_year_id: data.academic_year || null,
        });
        return { name: res.data.id || `ENR-${Date.now()}`, ...data };
      } catch { return { name: `ENR-${Date.now()}`, ...data }; }
    },
  },

  // ── Homework Assignment ──
  'Homework Assignment': {
    async list(filters, fields, pageLength, pageStart) {
      const url = urlFor('Homework Assignment', 'list');
      const params = { limit: pageLength || 100, offset: pageStart || 0 };
      const sgFilter = filters?.find(f => f[0] === 'student_group')?.[2];
      const courseFilter = filters?.find(f => f[0] === 'course')?.[2];
      const statusFilter = filters?.find(f => f[0] === 'status')?.[2];
      const byFilter = filters?.find(f => f[0] === 'assigned_by')?.[2];
      if (sgFilter) params.student_group = sgFilter;
      if (courseFilter) params.course = courseFilter;
      if (statusFilter) params.status = statusFilter;
      if (byFilter) params.assigned_by = byFilter;
      try {
        const res = await client.get(url, { params });
        let items = res.data;
        if (!Array.isArray(items)) items = items.data || items.results || [];
        return items.map(h => ({
          name: h.id || h.name,
          title: h.title || '',
          description: h.description || '',
          course: h.course || '',
          course_name: h.course_name || '',
          student_group: h.student_group || '',
          class_name: h.class_name || '',
          academic_year: h.academic_year || '',
          due_date: h.due_date || '',
          max_points: h.max_points || null,
          assigned_by: h.assigned_by || '',
          assigned_by_name: h.assigned_by_name || '',
          assigned_date: h.assigned_date || '',
          status: h.status || 'Published',
          gc_course_id: h.gc_course_id || '',
          gc_course_work_id: h.gc_course_work_id || '',
          gc_invite_code: h.gc_invite_code || '',
          gc_course_link: h.gc_course_link || '',
          sync_status: h.sync_status || 'pending',
          creation: h.created_at || '',
          ...pick(h, fields),
        }));
      } catch { return []; }
    },
    async get(name) {
      const url = urlFor('Homework Assignment', 'single', name);
      try {
        const res = await client.get(url);
        const h = res.data.data || res.data;
        return {
          name: h.id || name,
          title: h.title || '',
          description: h.description || '',
          course: h.course || '',
          course_name: h.course_name || '',
          student_group: h.student_group || '',
          class_name: h.class_name || '',
          academic_year: h.academic_year || '',
          due_date: h.due_date || '',
          max_points: h.max_points || null,
          assigned_by: h.assigned_by || '',
          assigned_by_name: h.assigned_by_name || '',
          assigned_date: h.assigned_date || '',
          status: h.status || 'Published',
          gc_course_id: h.gc_course_id || '',
          gc_course_work_id: h.gc_course_work_id || '',
          gc_invite_code: h.gc_invite_code || '',
          gc_course_link: h.gc_course_link || '',
          sync_status: h.sync_status || 'pending',
          sync_error: h.sync_error || null,
        };
      } catch { return { name, doctype: 'Homework Assignment' }; }
    },
    async create(data) {
      try {
        const res = await client.post('/homework', {
          title: data.title || '',
          description: data.description || '',
          course: data.course || '',
          course_name: data.course_name || '',
          student_group: data.student_group || '',
          class_name: data.class_name || '',
          academic_year: data.academic_year || '',
          due_date: data.due_date || null,
          max_points: data.max_points || null,
          assigned_by: data.assigned_by || '',
          assigned_by_name: data.assigned_by_name || '',
          status: data.status || 'Published',
        });
        return { name: res.data.id || `HW-${Date.now()}`, ...data };
      } catch { return { name: `HW-${Date.now()}`, ...data }; }
    },
    async update(name, data) {
      try {
        const body = {};
        if (data.title !== undefined) body.title = data.title;
        if (data.description !== undefined) body.description = data.description;
        if (data.course !== undefined) body.course = data.course;
        if (data.course_name !== undefined) body.course_name = data.course_name;
        if (data.student_group !== undefined) body.student_group = data.student_group;
        if (data.class_name !== undefined) body.class_name = data.class_name;
        if (data.due_date !== undefined) body.due_date = data.due_date;
        if (data.max_points !== undefined) body.max_points = data.max_points;
        if (data.status !== undefined) body.status = data.status;
        if (data.gc_course_id !== undefined) body.gc_course_id = data.gc_course_id;
        if (data.gc_course_work_id !== undefined) body.gc_course_work_id = data.gc_course_work_id;
        if (data.gc_invite_code !== undefined) body.gc_invite_code = data.gc_invite_code;
        if (data.gc_course_link !== undefined) body.gc_course_link = data.gc_course_link;
        if (data.sync_status !== undefined) body.sync_status = data.sync_status;
        if (data.sync_error !== undefined) body.sync_error = data.sync_error;
        await client.patch(`/homework/${name}`, body);
        return { name, ...data };
      } catch { return { name, ...data }; }
    },
    async delete(name) {
      await client.delete(`/homework/${name}`);
    },
  },

  // ── Payment Entry ──
  'Payment Entry': {
    async list(filters, fields, pageLength, pageStart) {
      const url = urlFor('Payment Entry', 'list');
      try {
        const res = await client.get(url, { params: { limit: pageLength || 100, offset: pageStart || 0 } });
        let items = res.data;
        if (!Array.isArray(items)) items = items.data || items.results || [];
        return items.map(p => ({
          name: p.id || p.name,
          mode_of_payment: p.mode_of_payment || 'Online Payment',
          amount: p.amount || 0,
          status: p.status || 'CREATED',
          reference_no: p.razorpay_order_id || '',
          ...pick(p, fields),
        }));
      } catch { return []; }
    },
    async get(name) {
      const url = urlFor('Payment Entry', 'single', name);
      try {
        const res = await client.get(url);
        const p = res.data.data || res.data;
        return { name: p.id || name, mode_of_payment: 'Online Payment', amount: p.amount || 0, status: p.status || 'CREATED' };
      } catch { return { name, doctype: 'Payment Entry' }; }
    },
    async create(data) {
      try {
        const res = await client.post('/fees/orders', { invoice_id: data.fee_invoice || '' });
        return { name: res.data.razorpay_order_id || `PAY-${Date.now()}`, ...data };
      } catch { return { name: `PAY-${Date.now()}`, ...data }; }
    },
  },

  // ── Employee → maps to instructor/staff ──
  'Employee': {
    async list(filters, fields) {
      const emailFilter = filters?.find(f => f[0] === 'user_id')?.[2];
      if (emailFilter) {
        try {
          const res = await client.get('/academic/instructors');
          const instructors = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.results || [];
          const match = instructors.find(i => i.email === emailFilter || i.user_id === emailFilter);
          if (match) return [{ name: match.user_id || match.id || match.name, employee_name: `${match.first_name || ''} ${match.last_name || ''}`.trim() || match.email }];
        } catch { /* ignore */ }
      }
      return [];
    },
    async get(name) {
      try {
        const res = await client.get(`/academic/instructors/${name}`);
        const i = res.data.data || res.data;
        return { name: i.id || i.user_id || name, employee_name: `${i.first_name || ''} ${i.last_name || ''}`.trim(), user_id: i.user_id || name };
      } catch { return { name, doctype: 'Employee' }; }
    },
    async create(data) { return { name: `emp-${Date.now()}`, ...data }; },
    async update(name, data) { return { name, ...data }; },
  },

  // ── Salary Slip ──
  'Salary Slip': {
    async list(filters, fields) {
      const empFilter = filters?.find(f => f[0] === 'employee')?.[2];
      if (empFilter) {
        try {
          const res = await client.get('/staff/salary-slips', { params: { staff_id: empFilter } });
          let items = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.results || [];
          return items.map(s => ({
            name: s.name || s.id,
            employee: s.staff_id || '',
            start_date: s.start_date || '',
            end_date: s.end_date || '',
            net_pay: s.net_pay || 0,
            gross_pay: s.gross_pay || 0,
            status: s.status || 'Draft',
          }));
        } catch { return []; }
      }
      return [];
    },
    async get(name) { return { name, doctype: 'Salary Slip' }; },
  },

  // ── Attendance (employee) ──
  'Attendance': {
    async list(filters) {
      const empFilter = filters?.find(f => f[0] === 'employee')?.[2];
      if (empFilter) {
        try {
          const res = await client.get('/staff/leaves', { params: { staff_id: empFilter } });
          let items = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.results || [];
          return items.map(l => ({
            name: l.id || l.name,
            employee: l.staff_id || empFilter,
            attendance_date: l.start_date || '',
            status: l.status || 'Present',
            leave_type: l.leave_type || '',
          }));
        } catch { return []; }
      }
      return [];
    },
    async get(name) { return { name, doctype: 'Attendance' }; },
  },

  // ── Student Group Instructor → teacher assignments ──
  'Student Group Instructor': {
    async list(filters, fields) {
      const instFilter = filters?.find(f => f[0] === 'instructor')?.[2];
      try {
        const res = await client.get('/academic/teacher-assignments');
        let items = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.results || [];
        if (instFilter) items = items.filter(i => i.instructor_id === instFilter || i.instructor === instFilter);
        return items.map(a => ({
          name: a.id || a.name,
          parent: a.section_id || a.section || '',
          instructor: a.instructor_id || a.instructor || '',
        }));
      } catch { return []; }
    },
  },

  // ── Fee Concession Request ──
  'Fee Concession Request': {
    async list() { return []; },
    async create(data) { return { name: `con-${Date.now()}`, ...data }; },
    async update(name, data) { return { name, ...data }; },
  },

  // ── Assessment Plan ──
  'Assessment Plan': {
    async list() { return []; },
  },

  // ── Accountant ──
  'Accountant': {
    async list(filters, fields) {
      const emailFilter = filters?.find(f => f[0] === 'user')?.[2];
      if (emailFilter) {
        try {
          const res = await client.get('/auth/users', { params: { role: 'accountant' } });
          const users = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.results || [];
          const match = users.find(u => u.email === emailFilter || u.id === emailFilter);
          if (match) return [{ name: match.id, accountant_name: match.first_name ? `${match.first_name} ${match.last_name || ''}`.trim() : match.email }];
        } catch { /* ignore */ }
      }
      return [];
    },
  },

  // ── Fallback for all other doctypes ──
  __fallback: {
    async list(filters, fields, pageLength, pageStart) { return []; },
    async get(name) { return { name, doctype: 'unknown' }; },
    async create(data) { return { name: `new-${Date.now()}`, ...data }; },
    async update(name, data) { return { name, ...data }; },
    async delete(name) {},
  },
};

function getHandler(doctype) {
  const h = HANDLERS[doctype];
  if (h) return h;
  const fb = HANDLERS.__fallback;
  return {
    async list(filters, fields, pageLength, pageStart) {
      const url = urlFor(doctype, 'list');
      if (url) return fetchList(doctype, url, filters, fields, pageLength, pageStart);
      return fb.list ? fb.list() : [];
    },
    async get(name) {
      const url = urlFor(doctype, 'single', name);
      if (url) return fetchDoc(doctype, url, name);
      return fb.get ? fb.get(name) : { name, doctype: 'unknown' };
    },
    create: fb.create,
    update: fb.update,
    delete: fb.delete,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getList(doctype, filters = [], fields = ['name'], pageLength = 100, pageStart = 0) {
  const h = getHandler(doctype);
  if (h.list) return h.list(filters, fields, pageLength, pageStart);
  return h.list ? h.list(filters, fields, pageLength, pageStart) : [];
}

export async function getDoc(doctype, name) {
  const h = getHandler(doctype);
  return h.get(name);
}

export async function createDoc(doctype, data) {
  const h = getHandler(doctype);
  return h.create(data);
}

export async function updateDoc(doctype, name, data) {
  const h = getHandler(doctype);
  return h.update(name, data);
}

export async function deleteDoc(doctype, name) {
  const h = getHandler(doctype);
  if (h.delete) return h.delete(name);
}

// ─── Old Admin stubs (still used by Attendance, Timetable) ────────────────────
export async function adminGetList(doctype, filters, fields, pageLength, pageStart) {
  return getList(doctype, filters, fields, pageLength, pageStart);
}

export async function adminCallMethod(method, args = {}) {
  if (method === 'frappe.client.get') return getDoc(args.doctype || args.name, args.name);
  return { message: 'ok' };
}

export async function adminCreateDoc(doctype, data) {
  return createDoc(doctype, data);
}

export async function adminUpdateDoc(doctype, name, data) {
  return updateDoc(doctype, name, data);
}

// ─── New Admin API ────────────────────────────────────────────────────────────
export async function adminListUsers(params = {}) {
  const res = await client.get('/admin/users', { params });
  return res.data;
}

export async function adminCreateUser(data) {
  const res = await client.post('/admin/users', data);
  return res.data;
}

export async function adminGetUser(userId) {
  const res = await client.get(`/admin/users/${userId}`);
  return res.data;
}

export async function adminUpdateUser(userId, data) {
  const res = await client.put(`/admin/users/${userId}`, data);
  return res.data;
}

export async function adminToggleUserStatus(userId) {
  const res = await client.patch(`/admin/users/${userId}/status`);
  return res.data;
}

export async function adminResetPassword(userId, newPassword) {
  const res = await client.post(`/admin/users/${userId}/reset-password`, { new_password: newPassword });
  return res.data;
}

export async function adminGetSettings() {
  const res = await client.get('/admin/settings');
  return res.data;
}

export async function adminUpdateSettings(settings) {
  const res = await client.put('/admin/settings', settings);
  return res.data;
}

export async function adminGetAuditLog(params = {}) {
  const res = await client.get('/admin/audit/log', { params });
  return res.data;
}

export async function adminGetDashboard() {
  const res = await client.get('/admin/dashboard');
  return res.data;
}

// ─── Strict variants (same as regular) ───────────────────────────────────────
export const getListStrict = getList;
export const getDocStrict = getDoc;

// ─── callMethod ───────────────────────────────────────────────────────────────
export async function callMethod(method, args = {}) {
  if (method === 'run_doc_method') {
    return { message: 'ok', docname: args.dn || args.docname };
  }
  return { message: 'ok' };
}

// ─── Staff / HR API ───────────────────────────────────────────────────────────

export async function getStaffList() {
  const [usersRes, instructorsRes] = await Promise.allSettled([
    client.get('/auth/users'),
    client.get('/academic/instructors'),
  ]);

  const users = usersRes.status === 'fulfilled'
    ? (Array.isArray(usersRes.value.data) ? usersRes.value.data : usersRes.value.data?.data || usersRes.value.data?.results || [])
    : [];

  const instructors = instructorsRes.status === 'fulfilled'
    ? (Array.isArray(instructorsRes.value.data) ? instructorsRes.value.data : instructorsRes.value.data?.data || instructorsRes.value.data?.results || [])
    : [];

  const instMap = {};
  instructors.forEach(i => {
    const key = i.user_id || i.email || i.id;
    if (key) instMap[key] = i;
  });

  const combined = [];
  const seen = new Set();

  users.forEach(u => {
    const key = u.email || u.id || u.name;
    if (!key || seen.has(key)) return;
    seen.add(key);
    const inst = instMap[key] || {};
    combined.push({
      id: key,
      email: u.email || '',
      first_name: inst.first_name || u.first_name || '',
      last_name: inst.last_name || u.last_name || '',
      full_name: `${inst.first_name || u.first_name || ''} ${inst.last_name || u.last_name || ''}`.trim() || u.email || key,
      role: u.role || 'teacher',
      department: inst.department || '',
      qualification: inst.qualification || '',
      employee_id: inst.employee_id || '',
      is_active: u.is_active ?? inst.is_active ?? true,
      phone: u.phone || inst.phone || '',
      user_id: inst.user_id || u.user_id || '',
    });
  });

  instructors.forEach(i => {
    const key = i.user_id || i.email || i.id;
    if (!key || seen.has(key)) return;
    seen.add(key);
    combined.push({
      id: key,
      email: i.email || '',
      first_name: i.first_name || '',
      last_name: i.last_name || '',
      full_name: `${i.first_name || ''} ${i.last_name || ''}`.trim() || i.email || key,
      role: i.role || 'teacher',
      department: i.department || '',
      qualification: i.qualification || '',
      employee_id: i.employee_id || '',
      is_active: i.is_active ?? true,
      phone: i.phone || '',
      user_id: i.user_id || '',
    });
  });

  return combined;
}

export async function getStaffLeaves(staff_id = '') {
  const params = {};
  if (staff_id) params.staff_id = staff_id;
  const res = await client.get('/staff/leaves', { params });
  let items = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.results || [];
  return items.map(l => ({
    id: l.id || l.name,
    staff_id: l.staff_id || '',
    staff_name: l.staff_name || '',
    leave_type: l.leave_type || 'Sick Leave',
    start_date: l.start_date || '',
    end_date: l.end_date || '',
    reason: l.reason || '',
    status: l.status || 'Pending',
    applied_on: l.applied_on || l.created_at || '',
    approved_by: l.approved_by || '',
  }));
}

export async function applyLeave(data) {
  const res = await client.post('/staff/leaves', {
    staff_id: data.staff_id || data.email || '',
    leave_type: data.leave_type || 'Sick Leave',
    start_date: data.start_date || '',
    end_date: data.end_date || '',
    reason: data.reason || '',
  });
  return { id: res.data.id || res.data.name, ...res.data };
}

export async function approveLeave(id, status, approver = '') {
  const res = await client.patch(`/staff/leaves/${id}/approve`, {
    status,
    approved_by: approver,
  });
  return res.data;
}

export async function getStaffAttendance(staff_id = '', start = '', end = '') {
  const params = {};
  if (staff_id) params.staff_id = staff_id;
  if (start) params.start = start;
  if (end) params.end = end;
  const res = await client.get('/staff/attendance', { params });
  let items = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.results || [];
  return items.map(a => ({
    id: a.id || a.name,
    staff_id: a.staff_id || a.employee_id || '',
    staff_name: a.staff_name || '',
    date: a.date || '',
    status: a.status || 'Present',
    check_in: a.check_in || '',
    check_out: a.check_out || '',
  }));
}

// ─── Payroll API ──────────────────────────────────────────────────────────────

export async function getPayrollRuns() {
  const res = await client.get('/staff/payroll/runs');
  let items = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.results || [];
  return items.map(r => ({
    id: r.id || r.name,
    year: r.year || '',
    month: r.month || '',
    status: r.status || 'draft',
    is_finalized: r.is_finalized ?? (r.status === 'finalized'),
    total_employees: r.total_employees || 0,
    total_gross: r.total_gross || 0,
    total_deductions: r.total_deductions || 0,
    total_net: r.total_net || 0,
    created_at: r.created_at || '',
    finalized_at: r.finalized_at || '',
  }));
}

export async function runPayroll(year, month) {
  const res = await client.post(`/staff/payroll/run/${year}/${month}`);
  return { id: res.data.id || res.data.name, ...res.data };
}

export async function finalizePayroll(run_id) {
  const res = await client.post(`/staff/payroll/finalize/${run_id}`);
  return res.data;
}

export async function getPayrollRecords(run_id = '') {
  const params = {};
  if (run_id) params.run_id = run_id;
  const res = await client.get('/staff/payroll/records', { params });
  let items = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.results || [];
  return items.map(r => ({
    id: r.id || r.name,
    run_id: r.run_id || '',
    staff_id: r.staff_id || '',
    staff_name: r.staff_name || '',
    gross_pay: r.gross_pay || 0,
    pf_deduction: r.pf_deduction || 0,
    esic_deduction: r.esic_deduction || 0,
    lop_deduction: r.lop_deduction || 0,
    total_deductions: r.total_deductions || 0,
    net_pay: r.net_pay || 0,
    days_worked: r.days_worked || 0,
    lop_days: r.lop_days || 0,
  }));
}

export async function getSalarySlips(staff_id = '') {
  const params = {};
  if (staff_id) params.staff_id = staff_id;
  const res = await client.get('/staff/salary-slips', { params });
  let items = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.results || [];
  return items.map(s => ({
    id: s.id || s.name,
    staff_id: s.staff_id || '',
    staff_name: s.staff_name || '',
    month: s.month || '',
    year: s.year || '',
    gross_pay: s.gross_pay || 0,
    net_pay: s.net_pay || 0,
    total_deductions: s.total_deductions || 0,
    status: s.status || 'Draft',
    generated_at: s.generated_at || '',
    run_id: s.run_id || '',
  }));
}

// ─── createUser / addRole / deleteUser ────────────────────────────────────────
export async function createUser(userData) {
  const res = await client.post('/auth/users', {
    email: userData.email,
    password: userData.password || 'password123',
    role: (userData.role || 'student').toLowerCase(),
    first_name: userData.first_name || userData.full_name?.split(' ')[0] || userData.email?.split('@')[0] || '',
    last_name: userData.last_name || userData.full_name?.split(' ').slice(1).join(' ') || '',
    phone: userData.phone || userData.mobile_no || null,
  });
  return { name: res.data.email || userData.email, ...userData };
}

export async function addRole(email, role) {
  const res = await client.get(`/auth/users/${email}`);
  await client.patch(`/auth/users/${email}`, { role: role.toLowerCase() });
}

export async function deleteUser(email) {
  await client.delete(`/auth/users/${email}`);
}

// ─── Library API ──────────────────────────────────────────────────────────────

export async function getLibraryBooks(params = {}) {
  const res = await client.get('/library/books', { params });
  let items = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.results || [];
  return items.map(b => ({
    id: b.id || b.name,
    title: b.title || '',
    author: b.author || '',
    isbn: b.isbn || '',
    publisher: b.publisher || '',
    category: b.category || b.category_id || '',
    category_name: b.category_name || b.category || '',
    total_copies: b.total_copies || 0,
    available_copies: b.available_copies || 0,
    description: b.description || '',
    cover_url: b.cover_url || '',
    is_active: b.is_active ?? true,
    created_at: b.created_at || '',
  }));
}

export async function getLibraryCategories() {
  const res = await client.get('/library/categories');
  let items = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.results || [];
  return items.map(c => ({
    id: c.id || c.name,
    name: c.name || '',
    description: c.description || '',
    book_count: c.book_count || 0,
  }));
}

export async function createLibraryCategory(data) {
  const res = await client.post('/library/categories', { name: data.name, description: data.description || '' });
  return { id: res.data.id || res.data.name, ...res.data };
}

export async function createLibraryBook(data) {
  const res = await client.post('/library/books', {
    title: data.title || '',
    author: data.author || '',
    isbn: data.isbn || '',
    publisher: data.publisher || '',
    category: data.category || data.category_id || '',
    total_copies: parseInt(data.total_copies) || 1,
    description: data.description || '',
  });
  return { id: res.data.id || res.data.name, ...res.data };
}

export async function updateLibraryBook(id, data) {
  const res = await client.patch(`/library/books/${id}`, {
    title: data.title,
    author: data.author,
    isbn: data.isbn,
    publisher: data.publisher,
    category: data.category || data.category_id,
    total_copies: data.total_copies ? parseInt(data.total_copies) : undefined,
    description: data.description,
  });
  return res.data;
}

export async function issueBook(data) {
  const params = { copy_id: data.copy_id, user_id: data.user_id };
  if (data.expected_return_date) params.expected_return_date = data.expected_return_date;
  const res = await client.post('/library/issue', null, { params });
  return { id: res.data.id || res.data.name, ...res.data };
}

export async function returnBook(issue_id) {
  const res = await client.post(`/library/return/${issue_id}`);
  return res.data;
}

export async function reserveBook(data) {
  const res = await client.post('/library/reserve', {
    book_id: data.book_id,
    user_id: data.user_id,
  });
  return { id: res.data.id || res.data.name, ...res.data };
}

export async function getBookIssues(params = {}) {
  const res = await client.get('/library/issues', { params });
  let items = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.results || [];
  return items.map(i => ({
    id: i.id || i.name,
    book_id: i.book_id || '',
    book_title: i.book_title || '',
    copy_barcode: i.copy_barcode || '',
    user_id: i.user_id || '',
    user_name: i.user_name || '',
    issue_date: i.issue_date || '',
    expected_return_date: i.expected_return_date || '',
    returned_at: i.returned_at || null,
    status: i.status || 'issued',
    overdue_days: i.overdue_days || 0,
    fine_amount: i.fine_amount || 0,
    fine_paid: i.fine_paid ?? false,
  }));
}

export async function getUserFines(user_id) {
  const res = await client.get(`/library/fines/user/${user_id}`);
  let items = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.results || [];
  return items.map(f => ({
    id: f.id || f.name,
    issue_id: f.issue_id || '',
    book_title: f.book_title || '',
    user_id: f.user_id || '',
    user_name: f.user_name || '',
    amount: f.amount || 0,
    reason: f.reason || '',
    status: f.is_paid ? 'paid' : (f.status || 'unpaid'),
    created_at: f.created_at || '',
    paid_at: f.paid_at || '',
  }));
}

// ─── Messaging & Notifications API ────────────────────────────────────────────

export async function getMessageThreads(params = {}) {
  const res = await client.get('/messaging/threads', { params });
  let items = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.results || [];
  return items.map(t => ({
    id: t.id || t.name,
    child_id: t.child_id || '',
    child_name: t.child_name || '',
    parent_id: t.parent_id || '',
    parent_name: t.parent_name || '',
    teacher_id: t.teacher_id || '',
    teacher_name: t.teacher_name || '',
    subject: t.subject || '',
    last_message: t.last_message || '',
    last_message_at: t.last_message_at || '',
    unread_count: t.unread_count || 0,
    created_at: t.created_at || '',
  }));
}

export async function getThreadMessages(threadId) {
  const res = await client.get(`/messaging/threads/${threadId}/messages`);
  let items = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.results || [];
  return items.map(m => ({
    id: m.id || m.name,
    thread_id: m.thread_id || threadId,
    sender_id: m.sender_id || '',
    sender_name: m.sender_name || '',
    sender_role: m.sender_role || '',
    message: m.message || '',
    attachments: m.attachments || [],
    created_at: m.created_at || '',
    is_read: m.is_read ?? false,
  }));
}

export async function sendMessage(data) {
  const res = await client.post(`/messaging/threads/${data.thread_id}/messages`, {
    sender_id: data.sender_id || '',
    sender_name: data.sender_name || '',
    sender_role: data.sender_role || '',
    message: data.message || '',
  });
  return { id: res.data.id || res.data.name, ...res.data };
}

export async function createMessageThread(data) {
  const res = await client.post('/messaging/threads', {
    child_id: data.child_id || '',
    teacher_id: data.teacher_id || '',
    subject: data.subject || '',
    parent_id: data.parent_id || '',
    parent_name: data.parent_name || '',
    message: data.message || '',
  });
  return { id: res.data.id || res.data.name, ...res.data };
}

export async function markThreadRead(threadId) {
  const res = await client.patch(`/messaging/threads/${threadId}/read`);
  return res.data;
}

export async function getNotificationPrefs() {
  const res = await client.get('/parent/notifications/prefs');
  let data = res.data?.data || res.data || {};
  return {
    id: data.id || data.name,
    sms_enabled: data.sms_enabled ?? true,
    email_enabled: data.email_enabled ?? true,
    push_enabled: data.push_enabled ?? true,
    events: Array.isArray(data.events) ? data.events : [],
  };
}

export async function updateNotificationPrefs(data) {
  const res = await client.patch('/parent/notifications/prefs', {
    sms_enabled: data.sms_enabled,
    email_enabled: data.email_enabled,
    push_enabled: data.push_enabled,
  });
  return res.data;
}

export async function getCirculars(params = {}) {
  const res = await client.get('/parent/circulars', { params });
  let items = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.results || [];
  return items.map(c => ({
    id: c.id || c.name,
    title: c.title || '',
    body: c.body || '',
    target_class: c.target_class || c.class_id || 'All',
    attachment_url: c.attachment_url || '',
    is_published: c.is_published ?? false,
    created_by: c.created_by || '',
    created_at: c.created_at || '',
    published_at: c.published_at || '',
  }));
}

export async function createCircular(data) {
  const res = await client.post('/parent/circulars', {
    title: data.title || '',
    body: data.body || '',
    target_class: data.target_class || '',
    attachment_url: data.attachment_url || '',
    is_published: data.is_published ?? false,
  });
  return { id: res.data.id || res.data.name, ...res.data };
}

export async function updateCircular(id, data) {
  const res = await client.patch(`/parent/circulars/${id}`, data);
  return res.data;
}

// ─── Admissions API ───────────────────────────────────────────────────────────

const ADMISSION_STAGES = [
  'INQUIRY', 'APPLICATION_SUBMITTED', 'DOCUMENTS_PENDING', 'DOCUMENTS_VERIFIED',
  'TEST_SCHEDULED', 'TEST_COMPLETED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED',
  'FEE_PENDING', 'ENROLLED',
];

export { ADMISSION_STAGES };

const ADMISSION_TRANSITIONS = {
  INQUIRY: ['APPLICATION_SUBMITTED'],
  APPLICATION_SUBMITTED: ['DOCUMENTS_PENDING'],
  DOCUMENTS_PENDING: ['DOCUMENTS_VERIFIED'],
  DOCUMENTS_VERIFIED: ['TEST_SCHEDULED'],
  TEST_SCHEDULED: ['TEST_COMPLETED'],
  TEST_COMPLETED: ['INTERVIEW_SCHEDULED'],
  INTERVIEW_SCHEDULED: ['INTERVIEW_COMPLETED'],
  INTERVIEW_COMPLETED: ['FEE_PENDING'],
  FEE_PENDING: ['ENROLLED'],
  ENROLLED: [],
};

export function getAllowedTransitions(status) {
  return ADMISSION_TRANSITIONS[status] || [];
}

export async function getAdmissions(params = {}) {
  const res = await client.get('/admissions', { params });
  let items = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.results || [];
  return items.map(a => ({
    id: a.id || a.name,
    applicant_name: a.applicant_name || '',
    date_of_birth: a.date_of_birth || '',
    gender: a.gender || '',
    phone: a.phone || '',
    email: a.email || '',
    address: a.address || '',
    class_applied: a.class_applied || '',
    academic_year: a.academic_year || '',
    previous_school: a.previous_school || '',
    parent_name: a.parent_name || '',
    parent_phone: a.parent_phone || '',
    parent_email: a.parent_email || '',
    status: a.status || 'INQUIRY',
    documents: Array.isArray(a.documents) ? a.documents : [],
    created_at: a.created_at || '',
    updated_at: a.updated_at || '',
  }));
}

export async function createAdmission(data) {
  const res = await client.post('/admissions', {
    applicant_name: data.applicant_name || '',
    date_of_birth: data.date_of_birth || '',
    gender: data.gender || '',
    phone: data.phone || '',
    email: data.email || '',
    address: data.address || '',
    class_applied: data.class_applied || '',
    academic_year: data.academic_year || '',
    previous_school: data.previous_school || '',
    parent_name: data.parent_name || '',
    parent_phone: data.parent_phone || '',
    parent_email: data.parent_email || '',
  });
  return { id: res.data.id || res.data.name, ...res.data };
}

export async function getAdmission(id) {
  const res = await client.get(`/admissions/${id}`);
  const a = res.data?.data || res.data;
  return {
    id: a.id || a.name,
    applicant_name: a.applicant_name || '',
    date_of_birth: a.date_of_birth || '',
    gender: a.gender || '',
    phone: a.phone || '',
    email: a.email || '',
    address: a.address || '',
    class_applied: a.class_applied || '',
    academic_year: a.academic_year || '',
    previous_school: a.previous_school || '',
    parent_name: a.parent_name || '',
    parent_phone: a.parent_phone || '',
    parent_email: a.parent_email || '',
    status: a.status || 'INQUIRY',
    documents: Array.isArray(a.documents) ? a.documents : [],
    created_at: a.created_at || '',
    updated_at: a.updated_at || '',
  };
}

export async function transitionAdmissionStatus(id, newStatus) {
  const res = await client.patch(`/admissions/${id}/status`, { status: newStatus });
  return res.data;
}

export async function uploadAdmissionDocument(id, file, docType = '') {
  const formData = new FormData();
  formData.append('file', file);
  if (docType) formData.append('document_type', docType);
  const res = await client.post(`/admissions/${id}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return { id: res.data.id || res.data.name, ...res.data };
}

export async function verifyAdmissionDocument(admissionId, docId) {
  const res = await client.post(`/admissions/${admissionId}/documents/${docId}/verify`);
  return res.data;
}

export async function enrollAdmissionStudent(admissionId) {
  const res = await client.post(`/admissions/${admissionId}/enroll`);
  return res.data;
}

export async function getParentChildren() {
  const res = await client.get('/parent/children');
  let items = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.results || [];
  return items.map(c => ({
    id: c.id || c.name,
    child_name: c.child_name || c.student_name || '',
    class_name: c.class_name || c.class_id || '',
    section_name: c.section_name || '',
    attendance_percentage: c.attendance_percentage || 0,
    fee_due: c.fee_due || 0,
    last_result: c.last_result || null,
    photo_url: c.photo_url || '',
  }));
}

export async function getParentChildAttendance(childId, start, end) {
  const res = await client.get(`/parent/child/${childId}/attendance`, { params: { start, end } });
  let items = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.results || [];
  return items.map(a => ({
    id: a.id || a.name,
    date: a.date || '',
    status: a.status || '',
    check_in: a.check_in || '',
    check_out: a.check_out || '',
  }));
}

export async function getParentChildFeeDues(childId) {
  const res = await client.get(`/parent/child/${childId}/fees/dues`);
  let items = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.results || [];
  return items.map(f => ({
    id: f.id || f.name,
    fee_type: f.fee_type || '',
    amount: f.amount || 0,
    due_date: f.due_date || '',
    late_fee: f.late_fee || 0,
    status: f.status || 'Unpaid',
    paid_at: f.paid_at || '',
  }));
}

export async function getParentChildResults(childId) {
  const res = await client.get(`/parent/child/${childId}/results`);
  let items = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.results || [];
  return items.map(r => ({
    id: r.id || r.name,
    exam_name: r.exam_name || '',
    subject: r.subject || '',
    marks_obtained: r.marks_obtained || 0,
    max_marks: r.max_marks || 0,
    grade: r.grade || '',
    rank: r.rank || null,
  }));
}

export async function getParentChildEligibility(childId) {
  const res = await client.get(`/parent/child/${childId}/eligibility`);
  return { eligible: res.data?.eligible ?? true, message: res.data?.message || '' };
}

export async function getParentChildLeaves(childId) {
  const res = await client.get(`/parent/child/${childId}/leaves`);
  let items = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.results || [];
  return items.map(l => ({
    id: l.id || l.name,
    leave_type: l.leave_type || '',
    start_date: l.start_date || '',
    end_date: l.end_date || '',
    reason: l.reason || '',
    status: l.status || 'Pending',
  }));
}

export async function applyParentChildLeave(childId, data) {
  const res = await client.post(`/parent/child/${childId}/leaves`, {
    leave_type: data.leave_type || '',
    start_date: data.start_date || '',
    end_date: data.end_date || '',
    reason: data.reason || '',
  });
  return { id: res.data.id || res.data.name, ...res.data };
}

export async function getParentChildSchedule(childId) {
  try {
    const student = await HANDLERS['Student'].get(childId);
    const sectionName = student.student_group || student.section_name || '';
    if (!sectionName) return [];
    const res = await client.get('/timetable/slots', { params: { section_id: sectionName } });
    let items = res.data;
    if (!Array.isArray(items)) items = items.data || items.results || [];
    return items.map(s => ({
      id: s.id,
      name: s.id,
      course: s.subject_name || s.subject_id || '',
      instructor: s.instructor_name || s.instructor_id || '',
      instructor_name: s.instructor_name || '',
      day_of_week: s.day_of_week,
      subject_name: s.subject_name || '',
    }));
  } catch { return []; }
}

export async function getParentChildLibrary(childId) {
  try {
    const student = await HANDLERS['Student'].get(childId);
    const user_id = student.user_id || student.student_email_id || student.email || childId;
    if (!user_id) return { issues: [], fines: 0 };
    
    let issues = [];
    let fines = 0;
    try {
      const res = await client.get('/library/issues', { params: { user_id } });
      issues = res.data?.data || res.data?.results || res.data || [];
    } catch { issues = []; }
    try {
      const res = await client.get(`/library/fines/user/${user_id}`);
      fines = res.data?.total_fine || 0;
    } catch { fines = 0; }
    
    return { issues, fines };
  } catch { return { issues: [], fines: 0 }; }
}

export async function getParentChildProfile(childId) {
  try {
    const student = await HANDLERS['Student'].get(childId);
    let class_teacher = null;
    let groupDoc = null;
    if (student.student_group) {
      groupDoc = await HANDLERS['Student Group'].get(student.student_group).catch(() => null);
      if (groupDoc) {
        class_teacher = groupDoc.class_teacher || null;
      }
    }
    return { ...student, class_teacher, groupData: groupDoc };
  } catch { return null; }
}

// ─── Exam System API ───────────────────────────────────────────────────────────

export async function getExams(params = {}) {
  const res = await client.get('/exams', { params });
  let items = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.results || [];
  return items.map(e => ({
    id: e.id || e.name,
    exam_name: e.exam_name || '',
    exam_type: e.exam_type || '',
    class_name: e.class_name || '',
    academic_year: e.academic_year || '',
    start_date: e.start_date || '',
    end_date: e.end_date || '',
    status: e.status || 'DRAFT',
    total_subjects: e.total_subjects || 0,
    total_students: e.total_students || 0,
    created_by: e.created_by || '',
    created_at: e.created_at || '',
  }));
}

export async function createExam(data) {
  const res = await client.post('/exams', {
    exam_name: data.exam_name || '',
    exam_type: data.exam_type || '',
    class_name: data.class_name || '',
    academic_year: data.academic_year || '',
    start_date: data.start_date || '',
    end_date: data.end_date || '',
  });
  return { id: res.data.id || res.data.name, ...res.data };
}

export async function getExam(id) {
  const res = await client.get(`/exams/${id}`);
  return res.data?.data || res.data;
}

export async function updateExamStatus(id, status) {
  const res = await client.patch(`/exams/${id}/status`, { status });
  return res.data;
}

export async function getExamSubjects(examId) {
  const res = await client.get(`/exams/${examId}/subjects`);
  let items = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.results || [];
  return items.map(s => ({
    id: s.id || s.name,
    subject_id: s.subject_id || '',
    subject_name: s.subject_name || '',
    max_marks: s.max_marks || 100,
    date: s.date || '',
  }));
}

export async function addExamSubject(examId, data) {
  const res = await client.post(`/exams/${examId}/subjects`, {
    subject_id: data.subject_id || '',
    max_marks: data.max_marks || 100,
    date: data.date || null,
  });
  return { id: res.data.id || res.data.name, ...res.data };
}

export async function getExamResults(examId, subjectId = '') {
  const params = {};
  if (subjectId) params.subject_id = subjectId;
  const res = await client.get(`/exams/${examId}/results`, { params });
  let items = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.results || [];
  return items.map(r => ({
    id: r.id || r.name,
    student_id: r.student_id || '',
    student_name: r.student_name || '',
    subject_id: r.subject_id || '',
    subject_name: r.subject_name || '',
    marks_obtained: r.marks_obtained ?? null,
    max_marks: r.max_marks || 100,
    grade: r.grade || '',
    remarks: r.remarks || '',
    version: r.version || 1,
  }));
}

export async function bulkSaveExamResults(examId, results) {
  const res = await client.post(`/exams/${examId}/results/bulk`, { results });
  return res.data;
}

export async function updateExamResult(resultId, data) {
  const res = await client.patch(`/exams/results/${resultId}`, {
    marks_obtained: data.marks_obtained,
    remarks: data.remarks,
    version: data.version,
  });
  return res.data;
}

export async function getGradingSchemes() {
  const res = await client.get('/exams/grading-schemes');
  let items = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.results || [];
  return items.map(g => ({
    id: g.id || g.name,
    scheme_name: g.scheme_name || '',
    grades: Array.isArray(g.grades) ? g.grades : [],
  }));
}

export async function createGradingScheme(data) {
  const res = await client.post('/exams/grading-schemes', {
    scheme_name: data.scheme_name || '',
    grades: data.grades || [],
  });
  return { id: res.data.id || res.data.name, ...res.data };
}

export async function getExamAggregates(examId) {
  const res = await client.get(`/exams/${examId}/aggregates`);
  let items = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.results || [];
  return items.map(a => ({
    student_id: a.student_id || '',
    student_name: a.student_name || '',
    total_marks: a.total_marks || 0,
    max_total: a.max_total || 0,
    percentage: a.percentage || 0,
    grade: a.grade || '',
    rank: a.rank || 0,
  }));
}

export async function triggerReportCards(examId) {
  const res = await client.post(`/exams/${examId}/report-cards`);
  return res.data;
}

// ─── submitDoc ────────────────────────────────────────────────────────────────
export async function submitDoc(doctype, name) {
  return { message: 'Submitted', docname: name };
}
