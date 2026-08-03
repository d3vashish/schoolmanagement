import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { client } from '../api/frappe';
import { useAuth } from './AuthContext';

const AcademicYearContext = createContext(null);

export function AcademicYearProvider({ children }) {
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';

  const { data: academicYears = [] } = useQuery({
    queryKey: ['academic-years'],
    queryFn: async () => {
      const res = await client.get('/academic/years');
      return res.data;
    },
    staleTime: 10 * 60 * 1000,
  });

  // selectedYear stores the UUID id
  const [selectedYear, setSelectedYearInternal] = useState('');

  // Auto-select active year on load
  useEffect(() => {
    if (academicYears.length > 0 && !selectedYear) {
      const active = academicYears.find(y => y.is_current) || academicYears[0];
      if (active) setSelectedYearInternal(active.id);
    }
  }, [academicYears, selectedYear]);

  const setSelectedYear = (yearId) => {
    if (!isTeacher && yearId) setSelectedYearInternal(yearId);
  };

  const selectedYearData = useMemo(
    () => academicYears.find(y => y.id === selectedYear) || null,
    [academicYears, selectedYear]
  );

  const currentYear = academicYears.find(y => y.is_current)?.id || '';
  const isCurrentYear = selectedYear === currentYear;

  const value = {
    selectedYear,       // UUID
    selectedYearId: selectedYearData?.id || null,  // alias (selectedYear already holds the id)
    setSelectedYear,
    academicYears,      // [{id, name, start_date, end_date, is_active}]
    selectedYearData,
    currentYear,
    isCurrentYear,
    isTeacher,
    yearGroups: [],
    yearPrograms: [],
    yearGroupNames: [],
  };

  return (
    <AcademicYearContext.Provider value={value}>
      {children}
    </AcademicYearContext.Provider>
  );
}

export const useAcademicYear = () => useContext(AcademicYearContext);
