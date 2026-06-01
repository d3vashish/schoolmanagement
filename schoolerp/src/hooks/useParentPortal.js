import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getParentChildren, getParentChildAttendance, getParentChildFeeDues, getParentChildResults,
  getParentChildEligibility, getParentChildLeaves, applyParentChildLeave,
  getParentChildSchedule, getParentChildLibrary, getParentChildProfile
} from '../api/frappe';

export function useParentChildren() {
  return useQuery({
    queryKey: ['parent-children'],
    queryFn: getParentChildren,
  });
}

export function useParentChildAttendance(childId, start, end) {
  return useQuery({
    queryKey: ['parent-child-attendance', childId, start, end],
    queryFn: () => getParentChildAttendance(childId, start, end),
    enabled: !!childId,
  });
}

export function useParentChildFeeDues(childId) {
  return useQuery({
    queryKey: ['parent-child-fee-dues', childId],
    queryFn: () => getParentChildFeeDues(childId),
    enabled: !!childId,
  });
}

export function useParentChildResults(childId) {
  return useQuery({
    queryKey: ['parent-child-results', childId],
    queryFn: () => getParentChildResults(childId),
    enabled: !!childId,
  });
}

export function useParentChildEligibility(childId) {
  return useQuery({
    queryKey: ['parent-child-eligibility', childId],
    queryFn: () => getParentChildEligibility(childId),
    enabled: !!childId,
  });
}

export function useParentChildLeaves(childId) {
  return useQuery({
    queryKey: ['parent-child-leaves', childId],
    queryFn: () => getParentChildLeaves(childId),
    enabled: !!childId,
  });
}

export function useApplyParentChildLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ childId, data }) => applyParentChildLeave(childId, data),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['parent-child-leaves', vars.childId] }); },
  });
}

export function useParentChildSchedule(childId) {
  return useQuery({
    queryKey: ['parent-child-schedule', childId],
    queryFn: () => getParentChildSchedule(childId),
    enabled: !!childId,
  });
}

export function useParentChildLibrary(childId) {
  return useQuery({
    queryKey: ['parent-child-library', childId],
    queryFn: () => getParentChildLibrary(childId),
    enabled: !!childId,
  });
}

export function useParentChildProfile(childId) {
  return useQuery({
    queryKey: ['parent-child-profile', childId],
    queryFn: () => getParentChildProfile(childId),
    enabled: !!childId,
  });
}
