import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getList, getDoc, createDoc, updateDoc, deleteDoc } from '../api/frappe';

/**
 * Generic hook to fetch a list of documents from ERPNext.
 * Query key: [doctype, 'list', { filters, pageLength, pageStart }]
 */
export function useFrappeList(doctype, filters = [], fields = ['name'], pageLength = 100, pageStart = 0, options = {}) {
  return useQuery({
    queryKey: [doctype, 'list', { filters, fields, pageLength, pageStart }],
    queryFn: () => getList(doctype, filters, fields, pageLength, pageStart),
    ...options,
  });
}

/**
 * Generic hook to fetch a single document from ERPNext.
 * Query key: [doctype, name]
 */
export function useFrappeDoc(doctype, name, options = {}) {
  return useQuery({
    queryKey: [doctype, name],
    queryFn: () => getDoc(doctype, name),
    enabled: !!doctype && !!name && (options.enabled !== false),
    ...options,
  });
}

/**
 * Generic mutation hook for creating a document.
 * Invalidates list queries for the doctype on success.
 */
export function useFrappeCreate(doctype, options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => createDoc(doctype, data),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: [doctype] });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Generic mutation hook for updating a document.
 * Invalidates list queries and the specific doc query on success.
 */
export function useFrappeUpdate(doctype, options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, data }) => updateDoc(doctype, name, data),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: [doctype] });
      queryClient.invalidateQueries({ queryKey: [doctype, variables.name] });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Generic mutation hook for deleting a document.
 * Invalidates list queries for the doctype on success.
 */
export function useFrappeDelete(doctype, options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name) => deleteDoc(doctype, name),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: [doctype] });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Generic mutation hook that supports create, update, and delete.
 * Pass the operation as { type: 'create'|'update'|'delete', ...params }
 */
export function useFrappeMutation(doctype, options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ type, name, data }) => {
      switch (type) {
        case 'create': return createDoc(doctype, data);
        case 'update': return updateDoc(doctype, name, data);
        case 'delete': return deleteDoc(doctype, name);
        default: throw new Error(`Unknown mutation type: ${type}`);
      }
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: [doctype] });
      if (variables.name) {
        queryClient.invalidateQueries({ queryKey: [doctype, variables.name] });
      }
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}
