/**
 * Google Classroom + Google Docs/Drive API Integration
 * Handles OAuth flow and all API calls for:
 *  - Homework (ASSIGNMENT)
 *  - Exams (ASSIGNMENT with exam tag)
 *  - Class Tests (SHORT_ANSWER_QUESTION)
 *  - Certificates (Google Docs → PDF via Drive)
 *  - Reports (submissions/grades aggregation)
 */

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const CERTIFICATE_TEMPLATE_ID = import.meta.env.VITE_CERTIFICATE_TEMPLATE_ID;

const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students',
  'https://www.googleapis.com/auth/classroom.coursework.me',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
  'https://www.googleapis.com/auth/classroom.student-submissions.students.readonly',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
].join(' ');

// ─── Token helpers ─────────────────────────────────────────────────────────────

function storeToken(tokenData) {
  sessionStorage.setItem('gc_token', JSON.stringify(tokenData));
}

function getStoredToken() {
  try {
    const raw = sessionStorage.getItem('gc_token');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearToken() {
  sessionStorage.removeItem('gc_token');
}

let tokenClient = null;
let currentToken = null;
let currentUserEmail = null;

export function initGoogleAuth(clientId) {
  return new Promise((resolve) => {
    if (typeof google === 'undefined' || !google.accounts) {
      resolve(false);
      return;
    }
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/classroom.courses https://www.googleapis.com/auth/classroom.coursework.students https://www.googleapis.com/auth/classroom.courses.readonly',
      callback: (response) => {
        if (response.access_token) {
          currentToken = response.access_token;
        }
      },
    });
    resolve(true);
  });
}

export function signInWithGoogle() {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google auth not initialized'));
      return;
    }
    tokenClient.callback = (response) => {
      if (response.error) {
        reject(new Error(response.error));
        return;
      }
      currentToken = response.access_token;
      currentUserEmail = response.email || null;
      resolve({
        accessToken: response.access_token,
        email: response.email,
        refreshToken: '',
        expiry: '',
      });
    };
    tokenClient.requestAccessToken();
  });
}

export function signOutFromGoogle() {
  const token = currentToken;
  currentToken = null;
  currentUserEmail = null;
  if (typeof google !== 'undefined' && google.accounts && token) {
    google.accounts.oauth2.revoke(token, () => {});
  }
}

export function getAccessToken() {
  return currentToken;
}

export function isConnected() {
  return !!currentToken;
}

// ─── OAuth Flow ───────────────────────────────────────────────────────────────

export function initiateGoogleAuth(returnPath = '/homework') {
  const redirectUri = `${window.location.origin}/gc-callback`;
  sessionStorage.setItem('gc_return_path', returnPath);

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: SCOPES,
    include_granted_scopes: 'true',
  });
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export function handleOAuthCallback() {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token');
  const expiresIn = params.get('expires_in');
  const error = params.get('error');

  if (error) throw new Error(`OAuth error: ${error}`);
  if (!accessToken) return null;

  const tokenData = { access_token: accessToken, expires_in: Number(expiresIn) };
  storeToken(tokenData);
  return tokenData;
}

// ─── API Base ─────────────────────────────────────────────────────────────────

async function apiFetch(baseUrl, path, options = {}) {
  const token = getStoredToken();
  if (!token) throw new Error('Not authenticated with Google. Please connect.');

  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearToken();
      throw new Error('Google session expired. Please reconnect.');
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

const classroomFetch = (path, opts) =>
  apiFetch('https://classroom.googleapis.com/v1', path, opts);

const driveFetch = (path, opts) =>
  apiFetch('https://www.googleapis.com/drive/v3', path, opts);

const docsFetch = (path, opts) =>
  apiFetch('https://docs.googleapis.com/v1', path, opts);

// ─── Courses ──────────────────────────────────────────────────────────────────

export async function getCourses() {
  const data = await classroomFetch('/courses?courseStates=ACTIVE&pageSize=50');
  return data?.courses || [];
}

// ─── Coursework (generic) ─────────────────────────────────────────────────────

export async function getCoursework(courseId) {
  const data = await classroomFetch(
    `/courses/${courseId}/courseWork?orderBy=dueDate%20desc&pageSize=100`
  );
  return data?.courseWork || [];
}

export async function createCoursework(courseId, assignment) {
  return classroomFetch(`/courses/${courseId}/courseWork`, {
    method: 'POST',
    body: JSON.stringify(assignment),
  });
}

export async function updateCoursework(courseId, courseWorkId, updates) {
  const updateMask = Object.keys(updates).join(',');
  return classroomFetch(
    `/courses/${courseId}/courseWork/${courseWorkId}?updateMask=${updateMask}`,
    { method: 'PATCH', body: JSON.stringify(updates) }
  );
}

export async function deleteCoursework(courseId, courseWorkId) {
  return classroomFetch(`/courses/${courseId}/courseWork/${courseWorkId}`, {
    method: 'DELETE',
  });
}

// ─── Typed Coursework Filters ─────────────────────────────────────────────────

export const COURSEWORK_TAGS = {
  EXAM: '[EXAM]',
  TEST: '[TEST]',
  HOMEWORK: null,
};

export function tagTitle(tag, title) {
  if (!tag) return title;
  return `${tag} ${title}`;
}

export function untagTitle(title = '') {
  return title.replace(/^\[(EXAM|TEST)\]\s*/, '');
}

export function getCourseworkTag(title = '') {
  if (title.startsWith('[EXAM]')) return 'EXAM';
  if (title.startsWith('[TEST]')) return 'TEST';
  return 'HOMEWORK';
}

export function filterByTag(items, tag) {
  return items.filter(cw => getCourseworkTag(cw.title) === tag);
}

// ─── Student Submissions ──────────────────────────────────────────────────────

export async function getSubmissions(courseId, courseWorkId) {
  const data = await classroomFetch(
    `/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions`
  );
  return data?.studentSubmissions || [];
}

export async function getAllSubmissionsForCourse(courseId) {
  const coursework = await getCoursework(courseId);
  const results = await Promise.allSettled(
    coursework.map(cw =>
      getSubmissions(courseId, cw.id).then(subs => ({ cw, subs }))
    )
  );
  return results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);
}

// ─── Students ─────────────────────────────────────────────────────────────────

export async function getCourseStudents(courseId) {
  const data = await classroomFetch(`/courses/${courseId}/students?pageSize=100`);
  return data?.students || [];
}

// ─── Reports helpers ──────────────────────────────────────────────────────────

export async function buildGradeMatrix(courseId) {
  const [students, allCwSubs] = await Promise.all([
    getCourseStudents(courseId),
    getAllSubmissionsForCourse(courseId),
  ]);

  const assignments = allCwSubs.map(({ cw }) => ({
    id: cw.id,
    title: untagTitle(cw.title),
    tag: getCourseworkTag(cw.title),
    maxPoints: cw.maxPoints || 0,
  }));

  const grades = {};
  for (const { cw, subs } of allCwSubs) {
    for (const sub of subs) {
      const sid = sub.userId;
      if (!grades[sid]) grades[sid] = {};
      grades[sid][cw.id] = {
        score: sub.assignedGrade ?? sub.draftGrade ?? null,
        state: sub.state,
        late: sub.late || false,
      };
    }
  }

  return { students, assignments, grades };
}

// ─── Google Docs / Drive — Certificates ──────────────────────────────────────

export async function generateCertificate({ studentName, course, date, grade, templateId }) {
  const docId = templateId || CERTIFICATE_TEMPLATE_ID;
  if (!docId) throw new Error('No certificate template ID configured. Set VITE_CERTIFICATE_TEMPLATE_ID.');

  const copy = await driveFetch(`/files/${docId}/copy`, {
    method: 'POST',
    body: JSON.stringify({ name: `Certificate - ${studentName}` }),
  });
  const copyId = copy.id;

  const requests = [
    { studentName, placeholder: '{{STUDENT_NAME}}' },
    { studentName: course, placeholder: '{{COURSE}}' },
    { studentName: date, placeholder: '{{DATE}}' },
    { studentName: grade, placeholder: '{{GRADE}}' },
  ].map(({ placeholder, studentName: val }) => ({
    replaceAllText: {
      containsText: { text: placeholder, matchCase: true },
      replaceText: val || '',
    },
  }));

  await docsFetch(`/documents/${copyId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests }),
  });

  const pdfRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${copyId}/export?mimeType=application/pdf`,
    {
      headers: { Authorization: `Bearer ${getStoredToken().access_token}` },
    }
  );
  if (!pdfRes.ok) throw new Error('Failed to export certificate as PDF');

  await driveFetch(`/files/${copyId}`, { method: 'DELETE' }).catch(() => {});

  const blob = await pdfRes.blob();
  return URL.createObjectURL(blob);
}

export async function listDriveTemplates() {
  const data = await driveFetch(
    `/files?q=mimeType%3D'application%2Fvnd.google-apps.document'&pageSize=20&fields=files(id,name,modifiedTime)`
  );
  return data?.files || [];
}

// ─── GC Integration Persistence (Frappe backend) ─────────────────────────────

export function getConnectedEmail() {
  return currentUserEmail || (() => {
    try {
      const stored = getStoredToken();
      return stored?.email || null;
    } catch { return null; }
  })();
}

export async function storeGCIntegration(user, tokenData) {
  const { callMethod } = await import('./frappe');
  return callMethod('schoolerp.api.google_classroom.store_integration', {
    user_email: user,
    access_token: tokenData.accessToken,
    gc_email: tokenData.email,
  });
}

export async function getGCIntegration(user) {
  const { callMethod } = await import('./frappe');
  return callMethod('schoolerp.api.google_classroom.get_integration', {
    user_email: user,
  });
}

export async function removeGCIntegration(user) {
  const { callMethod } = await import('./frappe');
  return callMethod('schoolerp.api.google_classroom.remove_integration', {
    user_email: user,
  });
}

// ─── Google Classroom REST helpers (with explicit token) ─────────────────────

function gcFetch(path, token, options = {}) {
  return fetch(`https://classroom.googleapis.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  }).then(async (res) => {
    if (!res.ok) {
      if (res.status === 401) throw new Error('Google session expired. Please reconnect.');
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Google API error ${res.status}`);
    }
    if (res.status === 204) return null;
    return res.json();
  });
}

export async function fetchGCCourses(token) {
  const data = await gcFetch('/courses?courseStates=ACTIVE&pageSize=50', token);
  return data?.courses || [];
}

export async function findOrCreateGCCourse(className, courseName, token) {
  const courses = await fetchGCCourses(token);
  const match = courses.find(
    c => c.name === className || c.section === className || c.descriptionHeading === courseName
  );
  if (match) return match;

  return gcFetch('/courses', token, {
    method: 'POST',
    body: JSON.stringify({
      name: className,
      section: className,
      descriptionHeading: courseName,
      ownerId: 'me',
      courseState: 'PROVISIONED',
    }),
  });
}

export async function createGCCourseWork(courseId, homework, token) {
  const payload = buildCourseworkPayload({
    title: homework.title,
    description: homework.description,
    dueDate: homework.dueDate,
    points: homework.maxPoints,
    tag: null,
  });
  return gcFetch(`/courses/${courseId}/courseWork`, token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatDueDate(dueDate, dueTime) {
  if (!dueDate) return null;
  const { year, month, day } = dueDate;
  const hours = dueTime?.hours || 23;
  const minutes = dueTime?.minutes || 59;
  return new Date(year, month - 1, day, hours, minutes);
}

export function buildCourseworkPayload({ title, description, dueDate, points, topicId, tag }) {
  const payload = {
    title: tag ? tagTitle(COURSEWORK_TAGS[tag], title) : title,
    description,
    workType: 'ASSIGNMENT',
    state: 'PUBLISHED',
    maxPoints: points != null ? Number(points) : null,
  };
  if (dueDate) {
    const d = new Date(dueDate);
    payload.dueDate = { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
    payload.dueTime = { hours: 23, minutes: 59, seconds: 0, nanos: 0 };
  }
  if (topicId) payload.topicId = topicId;
  return payload;
}

export function getCourseInviteLink(courseId) {
  return `https://classroom.google.com/c/${courseId}`;
}
