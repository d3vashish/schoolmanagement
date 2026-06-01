import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import {
  initGoogleAuth,
  getAccessToken,
  isConnected,
  getConnectedEmail,
  storeGCIntegration,
  getGCIntegration,
  removeGCIntegration,
  fetchGCCourses,
  findOrCreateGCCourse,
  createGCCourseWork,
  getCourses,
  getCoursework,
  createCoursework,
  updateCoursework,
  deleteCoursework,
  getSubmissions,
  getCourseStudents,
  getAllSubmissionsForCourse,
  buildGradeMatrix,
  generateCertificate,
  listDriveTemplates,
  filterByTag,
} from '../api/googleClassroom';

const GC_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export function useGCConnection() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['gc', 'connection', user?.name],
    queryFn: async () => {
      const stored = await getGCIntegration(user?.name);
      const online = isConnected();
      return {
        connected: online || !!stored?.is_active,
        email: getConnectedEmail() || stored?.gc_email || '',
        storedToken: stored?.access_token || null,
      };
    },
    staleTime: 60 * 1000,
  });
}

export function useGCConnect() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      await initGoogleAuth(GC_CLIENT_ID);
      const tokenData = await signInWithGoogle();
      await storeGCIntegration(user?.name, tokenData);
      return tokenData;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gc'] });
    },
  });
}

export function useGCDisconnect() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      await removeGCIntegration(user?.name);
      signOutFromGoogle();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gc'] });
    },
  });
}

export function useGCSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ homework, className, courseName, gcToken }) => {
      const token = gcToken || getAccessToken();
      if (!token) throw new Error('Google Classroom not connected');

      const course = await findOrCreateGCCourse(className, courseName, token);
      const coursework = await createGCCourseWork(course.id, homework, token);

      return {
        gcCourseId: course.id,
        gcCourseWorkId: coursework.id,
        gcInviteCode: course.enrollmentCode,
        gcCourseLink: `https://classroom.google.com/c/${course.id}`,
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['homework'] });
    },
  });
}

export function useGCCourses() {
  return useQuery({
    queryKey: ['gc', 'courses'],
    queryFn: async () => {
      const token = getAccessToken();
      if (!token) return [];
      return fetchGCCourses(token);
    },
    enabled: isConnected(),
    staleTime: 5 * 60 * 1000,
  });
}
// ─── Coursework (all) ─────────────────────────────────────────────────────────

export function useGCCoursework(courseId) {
  return useQuery({
    queryKey: ['gc', 'coursework', courseId],
    queryFn: () => getCoursework(courseId),
    enabled: !!courseId && isConnected(),
    staleTime: 2 * 60 * 1000,
  });
}

// ─── Typed Coursework ─────────────────────────────────────────────────────────
// Each hook returns only items matching the given tag (EXAM / TEST / HOMEWORK)

export function useGCTypedCoursework(courseId, tag) {
  return useQuery({
    queryKey: ['gc', 'coursework', courseId, tag],
    queryFn: async () => {
      const all = await getCoursework(courseId);
      return filterByTag(all, tag);
    },
    enabled: !!courseId && isConnected(),
    staleTime: 2 * 60 * 1000,
  });
}

// ─── Mutations (shared for all types) ────────────────────────────────────────

export function useGCCreateCoursework(courseId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assignment) => createCoursework(courseId, assignment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gc', 'coursework', courseId] });
    },
  });
}

export function useGCUpdateCoursework(courseId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ courseWorkId, updates }) =>
      updateCoursework(courseId, courseWorkId, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gc', 'coursework', courseId] });
    },
  });
}

export function useGCDeleteCoursework(courseId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (courseWorkId) => deleteCoursework(courseId, courseWorkId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gc', 'coursework', courseId] });
    },
  });
}

// ─── Submissions ──────────────────────────────────────────────────────────────

export function useGCSubmissions(courseId, courseWorkId) {
  return useQuery({
    queryKey: ['gc', 'submissions', courseId, courseWorkId],
    queryFn: () => getSubmissions(courseId, courseWorkId),
    enabled: !!courseId && !!courseWorkId && isConnected(),
  });
}

export function useGCAllSubmissions(courseId) {
  return useQuery({
    queryKey: ['gc', 'allSubmissions', courseId],
    queryFn: () => getAllSubmissionsForCourse(courseId),
    enabled: !!courseId && isConnected(),
    staleTime: 3 * 60 * 1000,
  });
}

// ─── Students ─────────────────────────────────────────────────────────────────

export function useGCStudents(courseId) {
  return useQuery({
    queryKey: ['gc', 'students', courseId],
    queryFn: () => getCourseStudents(courseId),
    enabled: !!courseId && isConnected(),
    staleTime: 10 * 60 * 1000,
  });
}

// ─── Grade Matrix (Reports) ───────────────────────────────────────────────────

export function useGCGradeMatrix(courseId) {
  return useQuery({
    queryKey: ['gc', 'gradeMatrix', courseId],
    queryFn: () => buildGradeMatrix(courseId),
    enabled: !!courseId && isConnected(),
    staleTime: 3 * 60 * 1000,
  });
}

// ─── Certificates ─────────────────────────────────────────────────────────────

export function useGCDriveTemplates() {
  return useQuery({
    queryKey: ['gc', 'driveTemplates'],
    queryFn: listDriveTemplates,
    enabled: isConnected(),
    staleTime: 10 * 60 * 1000,
  });
}

export function useGCGenerateCertificate() {
  return useMutation({
    mutationFn: (params) => generateCertificate(params),
  });
}
