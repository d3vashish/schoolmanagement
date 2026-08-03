// hooks/useHomework.js
//
// Mostly unchanged from before - these hooks just call the api/ functions.
// Renamed the Frappe-style 'name' identifier to 'id' (FastAPI uses UUID ids,
// not Frappe doctype names) and added useMyTeachingProfile for the Assign form's
// Class dropdown.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getHomeworkList,
  getHomeworkDoc,
  createHomework,
  updateHomework,
  deleteHomework,
  getMyTeachingProfile,
} from '../api/homework';

export function useHomeworkList(filters = {}) {
  return useQuery({
    queryKey: ['homework', 'list', filters],
    queryFn: () => getHomeworkList(filters),
    staleTime: 30 * 1000,
  });
}

export function useHomeworkDoc(id) {
  return useQuery({
    queryKey: ['homework', id],
    queryFn: () => getHomeworkDoc(id),
    enabled: !!id,
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
    mutationFn: ({ id, updates }) => updateHomework(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['homework'] });
    },
  });
}

export function useDeleteHomework() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => deleteHomework(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['homework'] });
    },
  });
}

// Powers the "Class" dropdown in the Assign form - only shows
// classes/sections/subjects the logged-in teacher actually teaches.
export function useMyTeachingProfile() {
  return useQuery({
    queryKey: ['homework', 'my-teaching-profile'],
    queryFn: () => getMyTeachingProfile(),
    staleTime: 5 * 60 * 1000,
  });
}