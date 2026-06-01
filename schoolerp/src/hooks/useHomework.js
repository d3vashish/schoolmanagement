import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getHomeworkList,
  getHomeworkDoc,
  createHomework,
  updateHomework,
  deleteHomework,
} from '../api/homework';

export function useHomeworkList(filters = {}) {
  return useQuery({
    queryKey: ['homework', 'list', filters],
    queryFn: () => getHomeworkList(filters),
    staleTime: 30 * 1000,
  });
}

export function useHomeworkDoc(name) {
  return useQuery({
    queryKey: ['homework', name],
    queryFn: () => getHomeworkDoc(name),
    enabled: !!name,
  });
}

export function useCreateHomework() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => createHomework(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['homework'] });
    },
  });
}

export function useUpdateHomework() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, updates }) => updateHomework(name, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['homework'] });
    },
  });
}

export function useDeleteHomework() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name) => deleteHomework(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['homework'] });
    },
  });
}
