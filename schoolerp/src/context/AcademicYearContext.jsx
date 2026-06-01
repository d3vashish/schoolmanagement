import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getList } from '../api/frappe';
import { useSettings } from './SettingsContext';
import { useAuth } from './AuthContext';

const AcademicYearContext = createContext(null);

export function AcademicYearProvider({ children }) {
  const settings = useSettings();
  const { user } = useAuth();
  const isTeacher = user?.roles?.includes('Instructor');

  const { data: academicYears = [] } = useQuery({
    queryKey: ['Academic Year'],
    queryFn: () => getList('Academic Year', [], ['name', 'academic_year_name', 'year_start_date', 'year_end_date'], 50),
    staleTime: 10 * 60 * 1000,
  });

  const [selectedYear, setSelectedYearInternal] = useState(() => settings?.academic_year || '');

  useEffect(() => {
    if (settings?.academic_year && !selectedYear) {
      setSelectedYearInternal(settings.academic_year);
    }
  }, [settings?.academic_year, selectedYear]);

  const setSelectedYear = (year) => {
    if (!isTeacher && year) setSelectedYearInternal(year);
  };

  const currentYear = settings?.academic_year || '';
  const isCurrentYear = selectedYear === currentYear;

  const selectedYearData = useMemo(() => academicYears.find(y => y.name === selectedYear) || null, [academicYears, selectedYear]);
  const yearStartDate = selectedYearData?.year_start_date || '';
  const yearEndDate = selectedYearData?.year_end_date || '';

  const { data: yearGroups = [] } = useQuery({
    queryKey: ['Student Group', 'list', { academic_year: selectedYear }],
    queryFn: () => {
      const filters = selectedYear ? [['academic_year', '=', selectedYear]] : [];
      return getList('Student Group', filters, ['name', 'student_group_name', 'program', 'class_teacher', 'academic_year'], 500);
    },
    enabled: !!selectedYear,
    staleTime: 2 * 60 * 1000,
  });

  const yearPrograms = useMemo(() => {
    const seen = new Map();
    yearGroups.forEach(g => { if (g.program && !seen.has(g.program)) seen.set(g.program, { name: g.program, program_name: g.program }); });
    return [...seen.values()].sort((a, b) => {
      const n = s => parseInt((s.program_name || s.name).match(/\d+/)?.[0] || '0');
      return n(a) - n(b);
    });
  }, [yearGroups]);

  const yearGroupNames = useMemo(() => yearGroups.map(g => g.name), [yearGroups]);

  const value = {
    selectedYear, setSelectedYear, academicYears, currentYear, isCurrentYear,
    yearStartDate, yearEndDate, isTeacher, loading: settings?.loading,
    yearGroups, yearPrograms, yearGroupNames,
  };

  return (
    <AcademicYearContext.Provider value={value}>{children}</AcademicYearContext.Provider>
  );
}

export const useAcademicYear = () => useContext(AcademicYearContext);
