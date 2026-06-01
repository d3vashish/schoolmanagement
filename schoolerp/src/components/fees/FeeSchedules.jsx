import { useState } from 'react';
import { useAcademicYear } from '../../context/AcademicYearContext';
import { useFeeSchedules, fmtDate } from '../../hooks/useFees';
import GenerateFeesModal from './GenerateFeesModal';

export default function FeeSchedules() {
  const { selectedYear } = useAcademicYear();
  const [showGenerate, setShowGenerate] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const yearFilter = selectedYear ? [['academic_year', '=', selectedYear]] : [];
  const { data: schedules = [], isLoading, error, refetch } = useFeeSchedules(yearFilter);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            View past fee generation schedules and their status.
          </p>
        </div>
        <button onClick={() => setShowGenerate(true)} className="btn-primary flex items-center gap-2 text-sm px-4 py-2.5 group">
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center transition-all duration-300 group-hover:bg-white/30 group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </span>
          Generate Fees
        </button>
      </div>

      {/* Error Banner */}
      {error && !dismissed && (
        <div className="flex items-center justify-between gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm">
          <div className="flex items-center gap-2">
            <span className="text-red-500 font-bold">!</span>
            <span className="text-red-700">{error?.readableMessage || 'Failed to load fee schedules'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => refetch()} className="text-red-600 hover:text-red-800 font-medium text-xs underline">Retry</button>
            <button onClick={() => setDismissed(true)} className="text-red-400 hover:text-red-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--color-text-secondary)]">Loading fee schedules...</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && schedules.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center text-3xl">
            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-[var(--color-text)] font-semibold">No fee schedules found</p>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              {error ? 'Unable to load fee schedules. This may be a permissions issue.' : 'Generate fees from a Fee Structure to create your first schedule.'}
            </p>
          </div>
          <button onClick={() => setShowGenerate(true)} className="btn-primary px-4 py-2 text-sm">
            Generate Fees
          </button>
        </div>
      )}

      {/* Schedule List */}
      {!isLoading && schedules.length > 0 && (
        <div className="rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Schedule</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Fee Structure</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Posting Date</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Due Date</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {schedules.map(s => (
                  <tr key={s.name} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-medium text-[var(--color-text)]">{s.name}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{s.fee_structure || '—'}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{fmtDate(s.posting_date)}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{fmtDate(s.due_date)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${
                        s.docstatus === 1
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-gray-50 text-gray-500 border-gray-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.docstatus === 1 ? 'bg-emerald-400' : 'bg-gray-400'}`} />
                        {s.docstatus === 1 ? 'Submitted' : 'Draft'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Generate Modal */}
      {showGenerate && (
        <GenerateFeesModal
          onClose={() => setShowGenerate(false)}
          onGenerated={() => { setShowGenerate(false); refetch(); }}
        />
      )}
    </div>
  );
}
