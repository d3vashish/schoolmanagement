import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from '../hooks/useDebounce';

export default function StudentSearch({ context, onSelect }) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const navigate = useNavigate();

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['student-search', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];
      const res = await fetch(`/api/academic/students/search?q=${encodeURIComponent(debouncedQuery)}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      return data;
    },
    enabled: debouncedQuery.length >= 2,
  });

  const handleSelect = (student) => {
    if (onSelect) {
      onSelect(student);
    } else {
      navigate(`/students/${student.id}`);
    }
    setQuery('');
  };

  return (
    <div className="relative">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={context === 'librarian' ? 'Search student to issue/return books...' : 'Search student by name or admission number...'}
          className="input pl-10"
        />
      </div>
      {query && debouncedQuery.length >= 2 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-gray-500">Searching...</div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">No students found</div>
          ) : (
            results.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSelect(s)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm">{s.first_name} {s.last_name}</span>
                    <span className="text-xs text-gray-400 ml-2">{s.admission_number}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {s.student_group_name}{s.section_name ? ` - ${s.section_name}` : ''}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
