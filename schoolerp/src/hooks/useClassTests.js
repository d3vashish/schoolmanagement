import { client } from '../api/frappe';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Sections a teacher is actually assigned to teach, deduped by section.
// Backed by GET /academic/my-teaching-profile (assignments array has one row
// per class+section+subject combo, so the same section can repeat — we dedupe
// here since Class Tests cares about sections, not subjects).
export function useMyTeachingSections(options = {}) {
  return useQuery({
    queryKey: ['ClassTests', 'my-sections'],
    queryFn: async () => {
  console.log('[useMyTeachingSections] firing');
  const res = await client.get('/academic/my-teaching-profile');
  console.log('[useMyTeachingSections] raw response:', res.data);
  const assignments = res.data?.assignments || [];
      const seen = new Set();
      const sections = [];
      for (const a of assignments) {
        if (seen.has(a.section_id)) continue;
        seen.add(a.section_id);
        sections.push({
          section_id: a.section_id,
          section_name: a.section_name,
          class_id: a.class_id,
          class_name: a.class_name,
        });
      }
      return sections.sort((x, y) => (x.class_name || '').localeCompare(y.class_name || '') || (x.section_name || '').localeCompare(y.section_name || ''));
    },
    ...options,
  });
}

export function useClassTests(sectionId, options = {}) {
  return useQuery({
    queryKey: ['ClassTests', 'list', sectionId],
    queryFn: async () => {
      const res = await client.get('/class-tests', { params: { section_id: sectionId } });
      return res.data;
    },
    enabled: !!sectionId,
    ...options,
  });
}

export function useClassTestDetail(testId, options = {}) {
  return useQuery({
    queryKey: ['ClassTests', 'detail', testId],
    queryFn: async () => {
      const res = await client.get(`/class-tests/${testId}`);
      return res.data;
    },
    enabled: !!testId,
    ...options,
  });
}

export function useCreateClassTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      // data: { title, description, section_id, test_date, max_marks }
      const res = await client.post('/class-tests', data);
      return res.data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['ClassTests', 'list', vars.section_id] });
    },
  });
}

export function useUpdateClassTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ testId, data }) => {
      const res = await client.patch(`/class-tests/${testId}`, data);
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['ClassTests', 'list', data.section_id] });
      qc.invalidateQueries({ queryKey: ['ClassTests', 'detail', data.id] });
    },
  });
}

export function useDeleteClassTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ testId }) => {
      await client.delete(`/class-tests/${testId}`);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['ClassTests'] });
    },
  });
}

export function useSaveMarks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ testId, marks }) => {
      // marks: [{ student_id, marks_obtained }]
      const res = await client.put(`/class-tests/${testId}/marks`, { marks });
      return res.data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['ClassTests', 'detail', vars.testId] });
      qc.invalidateQueries({ queryKey: ['ClassTests', 'list'] });
    },
  });
}