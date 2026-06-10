import { useState } from 'react';
import { useStudentLedger, useLedgerSummary, useJournalEntries, INR, fmtDate } from '../../hooks/useFees';

export default function StudentLedger({ studentId, onRecordPayment, onJournalAdjust }) {
  const [tab, setTab] = useState('ledger');
  const { data: entries = [], isLoading: loadingEntries } = useStudentLedger(studentId);
  const { data: summary, isLoading: loadingSummary } = useLedgerSummary(studentId);
  const { data: adjustments = [] } = useJournalEntries(studentId);
  const [dismissed, setDismissed] = useState(new Set());

  const errors = [];

  if (loadingEntries || loadingSummary) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-10 h-10 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[var(--color-text-secondary)]">Loading ledger...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border bg-gradient-to-br from-[#E8F9ED] to-[#BBF7D0] text-[#2ED05D] border-[#BBF7D0] p-4">
          <div className="text-2xl font-bold leading-tight">{INR(summary?.total_due || 0)}</div>
          <div className="text-xs font-medium opacity-70 mt-1">Total Due</div>
        </div>
        <div className="rounded-2xl border bg-gradient-to-br from-emerald-50 to-green-100 text-emerald-700 border-emerald-200 p-4">
          <div className="text-2xl font-bold leading-tight">{INR(summary?.total_paid || 0)}</div>
          <div className="text-xs font-medium opacity-70 mt-1">Total Paid</div>
        </div>
        <div className="rounded-2xl border bg-gradient-to-br from-red-50 to-rose-100 text-red-700 border-red-200 p-4">
          <div className="text-2xl font-bold leading-tight">{INR(summary?.balance || 0)}</div>
          <div className="text-xs font-medium opacity-70 mt-1">Balance</div>
        </div>
        <div className="rounded-2xl border bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-700 border-blue-200 p-4">
          <div className="text-2xl font-bold leading-tight">
            {entries.filter(e => e.entry_type === 'INVOICE').length}
          </div>
          <div className="text-xs font-medium opacity-70 mt-1">Invoice Entries</div>
          <div className="text-xs opacity-50 mt-0.5">lifecycle events</div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-2">
        <button onClick={() => setTab('ledger')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === 'ledger'
              ? 'bg-[var(--color-primary)] text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}>
          Ledger Entries
        </button>
        <button onClick={() => setTab('adjustments')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === 'adjustments'
              ? 'bg-[var(--color-primary)] text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}>
          Adjustments
        </button>
        <div className="flex-1" />
        {onRecordPayment && (
          <button onClick={onRecordPayment}
            className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 transition">
            Record Payment
          </button>
        )}
        {onJournalAdjust && (
          <button onClick={onJournalAdjust}
            className="px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition">
            Journal Adjust
          </button>
        )}
      </div>

      {/* Ledger Table */}
      {tab === 'ledger' && (
        <div className="card !p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-[var(--color-text)]">Ledger Entries</h3>
          </div>
          {entries.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">No ledger entries</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['Date', 'Type', 'Description', 'Amount', 'Balance', 'Reference'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {entries.map(entry => {
                    const isDebit = entry.entry_type === 'INVOICE' || entry.entry_type === 'ADJUSTMENT_DEBIT';
                    return (
                      <tr key={entry.id}>
                        <td className="px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">{fmtDate(entry.created_at)}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                            isDebit
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {entry.entry_type}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-[var(--color-text)]">{entry.description || '—'}</td>
                        <td className={`px-5 py-3.5 text-sm font-semibold whitespace-nowrap ${
                          isDebit ? 'text-red-600' : 'text-emerald-600'
                        }`}>
                          {isDebit ? '+' : '-'}{INR(entry.amount)}
                        </td>
                        <td className="px-5 py-3.5 text-sm font-semibold text-[var(--color-text)] whitespace-nowrap">{INR(entry.running_balance)}</td>
                        <td className="px-5 py-3.5 text-sm text-gray-400 whitespace-nowrap">
                          {entry.ref_type ? `${entry.ref_type}${entry.ref_id ? ` #${String(entry.ref_id).slice(0, 8)}` : ''}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Adjustments Tab */}
      {tab === 'adjustments' && (
        <div className="card !p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-[var(--color-text)]">Journal Adjustments</h3>
          </div>
          {adjustments.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">No adjustments recorded</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['Date', 'Description', 'Debit', 'Credit', 'Status'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {adjustments.map(adj => (
                    <tr key={adj.id}>
                      <td className="px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">{fmtDate(adj.created_at)}</td>
                      <td className="px-5 py-3.5 text-sm text-[var(--color-text)]">{adj.description}</td>
                      <td className="px-5 py-3.5 text-sm font-semibold text-red-600 whitespace-nowrap">
                        {adj.debit_amount > 0 ? INR(adj.debit_amount) : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-sm font-semibold text-emerald-600 whitespace-nowrap">
                        {adj.credit_amount > 0 ? INR(adj.credit_amount) : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                          adj.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            : adj.status === 'REJECTED'
                            ? 'bg-red-100 text-red-700 border-red-200'
                            : 'bg-amber-100 text-amber-700 border-amber-200'
                        }`}>
                          {adj.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
