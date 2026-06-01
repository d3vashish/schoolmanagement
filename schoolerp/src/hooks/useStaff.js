import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getStaffList, getStaffLeaves, applyLeave, approveLeave, getStaffAttendance,
  getPayrollRuns, runPayroll, finalizePayroll, getPayrollRecords, getSalarySlips,
} from '../api/frappe';

// ─── Employee Directory ───────────────────────────────────────────────────────

export function useStaffList(options = {}) {
  return useQuery({
    queryKey: ['staff', 'directory'],
    queryFn: getStaffList,
    ...options,
  });
}

// ─── Staff Leaves ─────────────────────────────────────────────────────────────

export function useStaffLeaves(staff_id = '', options = {}) {
  return useQuery({
    queryKey: ['staff', 'leaves', staff_id],
    queryFn: () => getStaffLeaves(staff_id),
    ...options,
  });
}

export function useApplyStaffLeave(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => applyLeave(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'leaves'] });
      options.onSuccess?.();
    },
    ...options,
  });
}

export function useApproveStaffLeave(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, approver }) => approveLeave(id, status, approver),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'leaves'] });
      options.onSuccess?.();
    },
    ...options,
  });
}

// ─── Staff Attendance ─────────────────────────────────────────────────────────

export function useStaffAttendance(staff_id = '', start = '', end = '', options = {}) {
  return useQuery({
    queryKey: ['staff', 'attendance', staff_id, start, end],
    queryFn: () => getStaffAttendance(staff_id, start, end),
    enabled: options.enabled !== false,
    ...options,
  });
}

// ─── Payroll ──────────────────────────────────────────────────────────────────

export function usePayrollRuns(options = {}) {
  return useQuery({
    queryKey: ['staff', 'payroll', 'runs'],
    queryFn: getPayrollRuns,
    ...options,
  });
}

export function useRunPayroll(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ year, month }) => runPayroll(year, month),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'payroll'] });
      options.onSuccess?.();
    },
    ...options,
  });
}

export function useFinalizePayroll(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (run_id) => finalizePayroll(run_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'payroll'] });
      options.onSuccess?.();
    },
    ...options,
  });
}

export function usePayrollRecords(run_id = '', options = {}) {
  return useQuery({
    queryKey: ['staff', 'payroll', 'records', run_id],
    queryFn: () => getPayrollRecords(run_id),
    enabled: !!run_id && options.enabled !== false,
    ...options,
  });
}

export function useSalarySlips(staff_id = '', options = {}) {
  return useQuery({
    queryKey: ['staff', 'salary-slips', staff_id],
    queryFn: () => getSalarySlips(staff_id),
    ...options,
  });
}
