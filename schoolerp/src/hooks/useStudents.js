import { useQuery } from '@tanstack/react-query';
import { getList, getDoc } from '../api/frappe';

export const useStudents = (filters = []) => {
  return useQuery({
    queryKey: ['students', filters],
    queryFn: () => getList('Student', filters, ['*']),
  });
};

export const useStudentProfile = (studentId) => {
  return useQuery({
    queryKey: ['studentProfile', studentId],
    queryFn: () => getDoc('Student', studentId),
    enabled: !!studentId,
  });
};

export const useStudentAttendance = (studentId, startDate, endDate) => {
  return useQuery({
    queryKey: ['studentAttendance', studentId, startDate, endDate],
    queryFn: () => {
      const filters = [['student', '=', studentId]];
      if (startDate && endDate) {
        filters.push(['date', 'between', [startDate, endDate]]);
      } else if (startDate) {
        filters.push(['date', '=', startDate]);
      }
      return getList('Student Attendance', filters, ['*']);
    },
    enabled: !!studentId,
  });
};

export const useStudentFees = (studentId) => {
  return useQuery({
    queryKey: ['studentFees', studentId],
    queryFn: () => getList('Fees', [['student', '=', studentId]], ['*']),
    enabled: !!studentId,
  });
};

export const useStudentLeaves = (studentId) => {
  return useQuery({
    queryKey: ['studentLeaves', studentId],
    queryFn: () => getList('Leave Application', [['student', '=', studentId]], ['*']),
    enabled: !!studentId,
  });
};
