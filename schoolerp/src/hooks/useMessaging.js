import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMessageThreads, getThreadMessages, sendMessage, createMessageThread, markThreadRead,
  getNotificationPrefs, updateNotificationPrefs,
  getCirculars, createCircular, updateCircular,
} from '../api/frappe';

export function useMessageThreads(params = {}) {
  return useQuery({
    queryKey: ['message-threads', params],
    queryFn: () => getMessageThreads(params),
  });
}

export function useThreadMessages(threadId) {
  return useQuery({
    queryKey: ['thread-messages', threadId],
    queryFn: () => getThreadMessages(threadId),
    enabled: !!threadId,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sendMessage,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['thread-messages', vars.thread_id] });
      qc.invalidateQueries({ queryKey: ['message-threads'] });
    },
  });
}

export function useCreateMessageThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createMessageThread,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['message-threads'] });
    },
  });
}

export function useMarkThreadRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markThreadRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['message-threads'] });
    },
  });
}

export function useNotificationPrefs() {
  return useQuery({
    queryKey: ['notification-prefs'],
    queryFn: getNotificationPrefs,
  });
}

export function useUpdateNotificationPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateNotificationPrefs,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-prefs'] });
    },
  });
}

export function useCirculars(params = {}) {
  return useQuery({
    queryKey: ['circulars', params],
    queryFn: () => getCirculars(params),
  });
}

export function useCreateCircular() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCircular,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['circulars'] });
    },
  });
}

export function useUpdateCircular() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => updateCircular(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['circulars'] });
    },
  });
}
