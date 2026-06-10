import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from '../api/frappe';

export const useClasses = () => {
  return useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const res = await client.get('/academic/classes');
      return res.data;
    },
  });
};

export const useClassDetail = (classId) => {
  return useQuery({
    queryKey: ['class-detail', classId],
    queryFn: async () => {
      const res = await client.get(`/academic/classes/${classId}/detail`);
      return res.data;
    },
    enabled: !!classId,
  });
};

export const useClassSubjects = (classId) => {
  return useQuery({
    queryKey: ['class-subjects', classId],
    queryFn: async () => {
      const res = await client.get(`/academic/classes/${classId}/subjects`);
      return res.data;
    },
    enabled: !!classId,
  });
};

export const useLinkSubject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ classId, subjectId }) => {
      const res = await client.post(`/academic/classes/${classId}/subjects`, { subject_id: subjectId });
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['class-subjects', variables.classId] });
      queryClient.invalidateQueries({ queryKey: ['class-detail', variables.classId] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
    onError: (err) => {
      alert(err.response?.data?.detail || 'Failed to link subject');
    },
  });
};

export const useUnlinkSubject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ classId, subjectId }) => {
      await client.delete(`/academic/classes/${classId}/subjects/${subjectId}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['class-subjects', variables.classId] });
      queryClient.invalidateQueries({ queryKey: ['class-detail', variables.classId] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
    onError: (err) => {
      alert(err.response?.data?.detail || 'Failed to unlink subject');
    },
  });
};

// ── Teacher Assignments ──────────────────────────────────────────────────

export const useTeacherAssignments = (classId) => {
  return useQuery({
    queryKey: ['teacher-assignments', classId],
    queryFn: async () => {
      // Fetch all assignments, then filter by class_id on client
      const res = await client.get('/academic/teacher-assignments');
      const all = res.data;
      return classId ? all.filter(a => a.class_id === classId) : all;
    },
    enabled: !!classId,
  });
};

export const useCreateTeacherAssignment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const res = await client.post('/academic/teacher-assignments', data);
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teacher-assignments', variables.class_id] });
    },
    onError: (err) => {
      alert(err.response?.data?.detail || 'Failed to assign teacher');
    },
  });
};

export const useDeleteTeacherAssignment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ assignmentId, classId }) => {
      await client.delete(`/academic/teacher-assignments/${assignmentId}`);
      return { classId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['teacher-assignments', result.classId] });
    },
    onError: (err) => {
      alert(err.response?.data?.detail || 'Failed to remove teacher assignment');
    },
  });
};

export const useInstructors = () => {
  return useQuery({
    queryKey: ['instructors'],
    queryFn: async () => {
      const res = await client.get('/academic/instructors');
      return res.data;
    },
  });
};
