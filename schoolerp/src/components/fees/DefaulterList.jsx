import { useState } from 'react';
import { useDefaulterReport, INR, fmtDate } from '../../hooks/useFees';

export default function DefaulterList() {
  const [dismissed, setDismissed] = useState(new Set());
  const { data: defaulters = [], isLoading, error, refetch } = useDefaulterReport();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-10 h-10 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[var(--color-text-secondary)]">Loading defaulter report...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && !dismissed.has('defaulters') && (
        <div className="flex items-center justify-between gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm">
          <span className="text-red-700">Failed to load defaulter report</span>
          <button onClick={() => refetch()}
            className="px-3 py-1 text-xs font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50">
            Retry
          </button>
        </div>
      )}

      <div className="card !p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-[var(--color-text)]">Defaulter List</h3>
            <p className="text-xs text-gray-400 mt-0.5">{defaulters.length} defaulters</p>
          </div>
          <span className="text-xs font-semibold text-gray-400">
            Sorted by outstanding balance
          </span>
        </div>
        {defaulters.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="text-2xl mb-2">No defaulters</div>
            <p className="text-sm text-gray-400">All invoices are paid or within due dates.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Student', 'Section', 'Total Due', 'Total Paid', 'Balance', 'Overdue Count'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {defaulters.map(d => (
                  <tr key={d.student_id}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-600 font-bold text-sm shrink-0">
                          {(d.student_name || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[var(--color-text)]">{d.student_name}</p>
                          <p className="text-xs text-gray-400">{d.student_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">{d.section || '—'}</td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-[var(--color-text)] whitespace-nowrap">{INR(d.total_due)}</td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-emerald-600 whitespace-nowrap">{INR(d.total_paid)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-sm font-semibold whitespace-nowrap ${
                        (d.balance || 0) > 0 ? 'text-red-600' : 'text-emerald-600'
                      }`}>
                        {INR(d.balance)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-50 text-red-600 text-sm font-bold">
                        {d.overdue_count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
