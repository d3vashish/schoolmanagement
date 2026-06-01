import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getLibraryBooks, createLibraryBook, updateLibraryBook,
  getLibraryCategories, createLibraryCategory,
  issueBook, returnBook, reserveBook, getBookIssues, getUserFines,
} from '../api/frappe';

export function useBookList(params = {}, options = {}) {
  return useQuery({
    queryKey: ['library', 'books', params],
    queryFn: () => getLibraryBooks(params),
    ...options,
  });
}

export function useBookCategories(options = {}) {
  return useQuery({
    queryKey: ['library', 'categories'],
    queryFn: getLibraryCategories,
    ...options,
  });
}

export function useCreateBook(options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => createLibraryBook(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['library', 'books'] }); options.onSuccess?.(); },
    ...options,
  });
}

export function useUpdateBook(options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => updateLibraryBook(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['library', 'books'] }); options.onSuccess?.(); },
    ...options,
  });
}

export function useCreateCategory(options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => createLibraryCategory(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['library', 'categories'] }); options.onSuccess?.(); },
    ...options,
  });
}

export function useIssueBook(options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => issueBook(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['library', 'issues'] }); options.onSuccess?.(); },
    ...options,
  });
}

export function useReturnBook(options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (issue_id) => returnBook(issue_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['library', 'issues'] });
      qc.invalidateQueries({ queryKey: ['library', 'books'] });
      options.onSuccess?.();
    },
    ...options,
  });
}

export function useReserveBook(options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => reserveBook(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['library', 'issues'] }); options.onSuccess?.(); },
    ...options,
  });
}

export function useBookIssues(params = {}, options = {}) {
  return useQuery({
    queryKey: ['library', 'issues', params],
    queryFn: () => getBookIssues(params),
    ...options,
  });
}

export function useUserFines(user_id, options = {}) {
  return useQuery({
    queryKey: ['library', 'fines', user_id],
    queryFn: () => getUserFines(user_id),
    enabled: !!user_id,
    ...options,
  });
}
