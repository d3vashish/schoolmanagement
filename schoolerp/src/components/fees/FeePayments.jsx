import { useState, useMemo } from 'react';
import { useAcademicYear } from '../../context/AcademicYearContext';
import { usePayments, useFees, INR, fmtDate } from '../../hooks/useFees';
import RecordPaymentModal from './RecordPaymentModal';

export default function FeePayments() {
  const { selectedYear } = useAcademicYear();
  const [showRecord, setShowRecord] = useState(false);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState('');

  const [dismissed, setDismissed] = useState(false);

  // Fetch Receive-type payments
  const { data: payments = [], isLoading, error, refetch } = usePayments(
    [['payment_type', '=', 'Receive']],
    { refetchInterval: 30000 }
  );

  // Fetch year-scoped fees to get student names for that year
  const yearFilter = selectedYear ? [['academic_year', '=', selectedYear]] : [];
  const { data: yearFees = [] } = useFees(yearFilter);
  const yearStudentNames = useMemo(() => new Set(yearFees.map(f => f.student_name)), [yearFees]);

  // Filter payments by year, search, and mode
  const yearFiltered = selectedYear
    ? payments.filter(p => yearStudentNames.has(p.party_name) || yearStudentNames.has(p.party))
    : payments;

  const filtered = yearFiltered.filter(p => {
    const q = search.toLowerCase();
    const matchQ = !search ||
      p.party_name?.toLowerCase().includes(q) ||
      p.name?.toLowerCase().includes(q) ||
      p.reference_no?.toLowerCase().includes(q);
    const matchM = !filterMode || p.mode_of_payment === filterMode;
    return matchQ && matchM;
  });

  const modes = [...new Set(yearFiltered.map(p => p.mode_of_payment).filter(Boolean))].sort();
  const totalCollected = yearFiltered.reduce((s, p) => s + (p.paid_amount || 0), 0);

  return (
    <div className="space-y-5">
      {/* Error Banner */}
      {error && !dismissed && (
        <div className="flex items-center justify-between gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm">
          <div className="flex items-center gap-2">
            <span className="text-red-500 font-bold">!</span>
            <span className="text-red-700">{error?.readableMessage || 'Failed to load payments'}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => refetch()}
              className="px-3 py-1 text-xs font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition">
              Retry
            </button>
            <button onClick={() => setDismissed(true)}
              className="text-red-400 hover:text-red-600 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Track all fee payments received from students.
          </p>
        </div>
        <button onClick={() => setShowRecord(true)} className="btn-primary flex items-center gap-2 text-sm px-4 py-2.5 group">
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center transition-all duration-300 group-hover:bg-white/30 group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </span>
          Record Payment
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-gradient-to-br from-emerald-50 to-green-100 text-emerald-700 border-emerald-200 p-4">
          <div className="text-2xl font-bold leading-tight">{INR(totalCollected)}</div>
          <div className="text-xs font-medium opacity-70 mt-1">Total Collected</div>
          <div className="text-xs opacity-50 mt-0.5">{yearFiltered.length} payments</div>
        </div>
        <div className="rounded-2xl border bg-gradient-to-br from-[#E8F9ED] to-[#BBF7D0] text-[#2ED05D] border-[#BBF7D0] p-4">
          <div className="text-2xl font-bold leading-tight">{modes.length}</div>
          <div className="text-xs font-medium opacity-70 mt-1">Payment Modes</div>
          <div className="text-xs opacity-50 mt-0.5">{modes.join(', ') || 'N/A'}</div>
        </div>
        <div className="rounded-2xl border bg-gradient-to-br from-blue-50 to-sky-100 text-blue-700 border-blue-200 p-4">
          <div className="text-2xl font-bold leading-tight">
            {payments.filter(p => {
              const d = new Date(p.posting_date);
              const now = new Date();
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }).length}
          </div>
          <div className="text-xs font-medium opacity-70 mt-1">This Month</div>
          <div className="text-xs opacity-50 mt-0.5">payments received</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="Search student or reference..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="input pl-9 text-sm" />
        </div>

        {modes.length > 0 && (
          <select value={filterMode} onChange={e => setFilterMode(e.target.value)}
            className="input text-sm w-auto min-w-[140px]">
            <option value="">All Modes</option>
            {modes.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}

        <span className="text-sm text-[var(--color-text-secondary)] ml-auto">
          {filtered.length} payment{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-28 gap-3">
          <div className="w-10 h-10 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--color-text-secondary)]">Loading payments...</p>
        </div>
      ) : yearFiltered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center text-4xl mb-4 border border-emerald-100">💰</div>
          <p className="font-bold text-[var(--color-text)] text-lg">No payments recorded yet</p>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1 max-w-xs">
            Record your first fee payment to start tracking collections.
          </p>
          <button onClick={() => setShowRecord(true)} className="mt-5 btn-primary text-sm px-5 py-2.5 flex items-center gap-2 group">
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </span>
            Record First Payment
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <p className="font-semibold text-[var(--color-text)]">No payments match your filters</p>
          <button onClick={() => { setSearch(''); setFilterMode(''); }}
            className="mt-3 text-sm text-[var(--color-primary)] hover:underline">Clear filters</button>
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Payment ID', 'Date', 'Student', 'Amount', 'Mode', 'Reference', 'Status'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(p => (
                  <tr key={p.name} className="hover:bg-[var(--color-primary)]/5 transition-colors">
                    <td className="px-5 py-4 text-sm font-semibold text-[var(--color-primary)] whitespace-nowrap">{p.name}</td>
                    <td className="px-5 py-4 text-sm text-gray-500 whitespace-nowrap">{fmtDate(p.posting_date)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-sm shrink-0">
                          {(p.party_name || '?')[0].toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-[var(--color-text)]">{p.party_name || p.party}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-emerald-600 whitespace-nowrap">{INR(p.paid_amount)}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                        {p.mode_of_payment || 'N/A'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500 whitespace-nowrap">{p.reference_no || '—'}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                        p.docstatus === 1
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                          : p.docstatus === 0
                          ? 'bg-gray-100 text-gray-600 border-gray-200'
                          : 'bg-red-100 text-red-700 border-red-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          p.docstatus === 1 ? 'bg-emerald-400' : p.docstatus === 0 ? 'bg-gray-400' : 'bg-red-400'
                        }`} />
                        {p.docstatus === 1 ? 'Submitted' : p.docstatus === 0 ? 'Draft' : 'Cancelled'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showRecord && (
        <RecordPaymentModal
          onClose={() => setShowRecord(false)}
          onSaved={() => setShowRecord(false)}
        />
      )}
    </div>
  );
}
