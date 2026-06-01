import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAdmissions, createAdmission, getAdmission, transitionAdmissionStatus,
  uploadAdmissionDocument, verifyAdmissionDocument, enrollAdmissionStudent, getAllowedTransitions,
} from '../api/frappe';

export function useAdmissionList(params = {}) {
  return useQuery({
    queryKey: ['admissions', params],
    queryFn: () => getAdmissions(params),
  });
}

export function useAdmission(id) {
  return useQuery({
    queryKey: ['admission', id],
    queryFn: () => getAdmission(id),
    enabled: !!id,
  });
}

export function useCreateAdmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAdmission,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admissions'] }); },
  });
}

export function useTransitionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => transitionAdmissionStatus(id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admissions'] }); },
  });
}

export function useUploadDocument() {
  return useMutation({
    mutationFn: ({ id, file, docType }) => uploadAdmissionDocument(id, file, docType),
  });
}

export function useVerifyDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ admissionId, docId }) => verifyAdmissionDocument(admissionId, docId),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['admission', vars.admissionId] }); },
  });
}

export function useEnrollStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: enrollAdmissionStudent,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admissions'] }); },
  });
}

export { getAllowedTransitions };
