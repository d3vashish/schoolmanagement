import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '../hooks/useDebounce';
import { isLibrarian, isAccountant } from '../utils/roles';
import { useAuth } from '../context/AuthContext';
import { client } from '../api/frappe';

export default function StudentLookup() {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const debouncedQuery = useDebounce(query, 300);
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['student-lookup', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];
      const res = await client.get(`/academic/students/search?q=${encodeURIComponent(debouncedQuery)}`);
      return res.data;
    },
    enabled: debouncedQuery.length >= 2,
  });

  const { data: financial } = useQuery({
    queryKey: ['student-financial', selected?.id],
    queryFn: async () => {
      const res = await client.get(`/academic/students/${selected.id}/financial`);
      return res.data;
    },
    enabled: !!selected && isAccountant(user),
  });

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Student Lookup</h1>
        <p className="text-sm text-gray-500">
          {isLibrarian(user) && 'Find a student to issue or return books.'}
          {isAccountant(user) && 'Look up a student to view fee and payment details.'}
        </p>
      </div>

      <div className="relative mb-8">
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or admission number..."
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition-shadow"
            autoFocus
          />
        </div>
        {query && debouncedQuery.length >= 2 && (
          <div className="absolute z-10 mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="p-6 text-center text-sm text-gray-500">Searching...</div>
            ) : results.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">No students found</div>
            ) : (
              results.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSelected(s); setQuery(''); }}
                  className="w-full text-left px-5 py-4 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{s.first_name} {s.last_name}</span>
                      <span className="text-sm text-gray-400 ml-3">{s.admission_number}</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {s.student_group_name}{s.section_name ? ` - ${s.section_name}` : ''}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {selected && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">{selected.first_name} {selected.last_name}</h2>
              <p className="text-sm text-gray-500">
                {selected.admission_number} &middot; {selected.student_group_name}{selected.section_name ? ` - ${selected.section_name}` : ''}
              </p>
            </div>
            <button
              onClick={() => navigate(`/students/${selected.id}`)}
              className="text-sm text-[var(--color-primary)] hover:underline"
            >
              View full profile &rarr;
            </button>
          </div>

          {isAccountant(user) && financial && (
            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{financial.total_fees_paid || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Total Fees Paid</p>
              </div>
              <div className="bg-yellow-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-yellow-600">{financial.total_fees_pending || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Pending Fees</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{financial.invoice_count || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Total Invoices</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
