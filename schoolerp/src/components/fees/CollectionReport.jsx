import { useState } from 'react';
import { useCollectionReport, INR, fmtDate } from '../../hooks/useFees';

export default function CollectionReport() {
  const [dismissed, setDismissed] = useState(new Set());
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const filters = {};
  if (fromDate) filters.from_date = fromDate;
  if (toDate) filters.to_date = toDate;

  const { data: report = [], isLoading, error, refetch } = useCollectionReport(filters);

  const totalCollected = report.reduce((s, r) => s + (r.total_collected || 0), 0);
  const totalPayments = report.reduce((s, r) => s + (r.payment_count || 0), 0);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-10 h-10 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[var(--color-text-secondary)]">Loading collection report...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && !dismissed.has('collections') && (
        <div className="flex items-center justify-between gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm">
          <span className="text-red-700">Failed to load collection report</span>
          <button onClick={() => refetch()}
            className="px-3 py-1 text-xs font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50">
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-gradient-to-br from-emerald-50 to-green-100 text-emerald-700 border-emerald-200 p-4">
          <div className="text-2xl font-bold leading-tight">{INR(totalCollected)}</div>
          <div className="text-xs font-medium opacity-70 mt-1">Total Collected</div>
        </div>
        <div className="rounded-2xl border bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-700 border-blue-200 p-4">
          <div className="text-2xl font-bold leading-tight">{totalPayments}</div>
          <div className="text-xs font-medium opacity-70 mt-1">Total Payments</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">From</label>
          <input type="date" value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="input text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">To</label>
          <input type="date" value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="input text-sm" />
        </div>
        {(fromDate || toDate) && (
          <button onClick={() => { setFromDate(''); setToDate(''); }}
            className="mt-5 text-xs text-gray-500 hover:text-gray-700 underline">
            Clear
          </button>
        )}
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-[var(--color-text)]">Daily Collection</h3>
        </div>
        {report.length === 0 ? (
          <div className="px-5 py-14 text-center text-sm text-gray-400">No collection data for this period</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Date', 'Amount Collected', 'Payment Count', 'Avg per Payment'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {report.map(row => (
                  <tr key={row.date}>
                    <td className="px-5 py-3.5 text-sm font-medium text-[var(--color-text)] whitespace-nowrap">{fmtDate(row.date)}</td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-emerald-600 whitespace-nowrap">{INR(row.total_collected)}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-semibold text-[var(--color-text)]">{row.payment_count}</span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">
                      {row.payment_count > 0 ? INR(row.total_collected / row.payment_count) : '—'}
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
