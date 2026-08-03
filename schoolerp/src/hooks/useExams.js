import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getExams, createExam, updateExamStatus,
  getExamSubjects, addExamSubject,
  getExamResults, bulkSaveExamResults, updateExamResult,
  getGradingSchemes, createGradingScheme,
  getExamAggregates, triggerReportCards,
  transitionExam, computeExam,
} from '../api/frappe';

export function useExams(params = {}) {
  return useQuery({
    queryKey: ['exams', params],
    queryFn: () => getExams(params),
  });
}

export function useCreateExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createExam,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['exams'] }); },
  });
}

export function useUpdateExamStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => updateExamStatus(id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['exams'] }); },
  });
}

export function useExamSubjects(examId) {
  return useQuery({
    queryKey: ['exam-subjects', examId],
    queryFn: () => getExamSubjects(examId),
    enabled: !!examId,
  });
}

export function useAddExamSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ examId, data }) => addExamSubject(examId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['exam-subjects'] }); },
  });
}

export function useExamResults(examId, subjectId) {
  return useQuery({
    queryKey: ['exam-results', examId, subjectId],
    queryFn: () => getExamResults(examId, subjectId),
    enabled: !!examId,
  });
}

export function useBulkSaveExamResults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ examId, results }) => bulkSaveExamResults(examId, results),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['exam-results', vars.examId] }); },
  });
}

export function useUpdateExamResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateExamResult,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['exam-results'] }); },
  });
}

export function useGradingSchemes() {
  return useQuery({
    queryKey: ['grading-schemes'],
    queryFn: getGradingSchemes,
  });
}

export function useCreateGradingScheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createGradingScheme,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['grading-schemes'] }); },
  });
}

export function useExamAggregates(examId) {
  return useQuery({
    queryKey: ['exam-aggregates', examId],
    queryFn: () => getExamAggregates(examId),
    enabled: !!examId,
  });
}

export function useTriggerReportCards() {
  return useMutation({
    mutationFn: triggerReportCards,
  });
}

export function useTransitionExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }) => transitionExam(id, action),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exams'] });
      qc.invalidateQueries({ queryKey: ['exam-results'] });
    },
  });
}

export function useComputeExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: computeExam,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['exam-aggregates'] }); },
  });
}