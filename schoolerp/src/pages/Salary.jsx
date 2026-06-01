import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { usePayrollRuns, useRunPayroll, useFinalizePayroll, usePayrollRecords, useSalarySlips } from '../hooks/useStaff';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const fmtCurrency = (n) => {
  const val = Number(n || 0);
  return val.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 });
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

export default function Salary() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('super_admin') || user?.roles?.includes('principal') || user?.roles?.includes('accountant');

  const [tab, setTab] = useState('overview');
  const [selectedRun, setSelectedRun] = useState('');
  const [runMonth, setRunMonth] = useState(new Date().getMonth() + 1);
  const [runYear, setRunYear] = useState(new Date().getFullYear());
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // ── Data ──

  const { data: payrollRuns = [], isLoading: loadingRuns } = usePayrollRuns({ enabled: tab === 'overview' || tab === 'records' });
  const { data: payrollRecords = [], isLoading: loadingRecords } = usePayrollRecords(selectedRun, { enabled: tab === 'records' && !!selectedRun });
  const { data: salarySlips = [], isLoading: loadingSlips } = useSalarySlips('', { enabled: tab === 'slips' });

  const runPayrollMutation = useRunPayroll({
    onSuccess: () => showToast('Payroll run created successfully!'),
    onError: (err) => showToast(err?.message || 'Failed to run payroll'),
  });

  const finalizeMutation = useFinalizePayroll({
    onSuccess: () => showToast('Payroll finalized successfully!'),
    onError: (err) => showToast(err?.message || 'Failed to finalize payroll'),
  });

  const sortedRuns = [...payrollRuns].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
  const latestRun = sortedRuns[0];
  const activeRun = selectedRun ? payrollRuns.find(r => r.id === selectedRun) : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl text-sm font-semibold bg-[#2D2A24] text-white shadow-[0_8px_32px_rgba(0,0,0,0.2)] animate-fade-in-up">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="eyebrow">HR & Finance</div>
          <h1 className="text-[2rem] sm:text-[2.5rem] font-extrabold text-[#2D2A24] tracking-tight leading-[1.1] -mt-1">Salary & Payroll</h1>
          <p className="text-[#8A8680] mt-2 font-medium text-sm">{payrollRuns.length} payroll runs</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex rounded-xl overflow-hidden border border-gray-200 w-fit shadow-sm flex-wrap">
        {[
          { k: 'overview', label: '📊 Overview' },
          { k: 'records', label: '📋 Payroll Records' },
          { k: 'slips', label: '📄 Salary Slips' },
        ].map(({ k, label }) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-5 py-2.5 text-sm font-medium transition-all ${
              tab === k ? 'bg-[var(--color-primary)] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          OVERVIEW TAB
          ═══════════════════════════════════════════════════════════ */}
      {tab === 'overview' && (
        <>
          {/* Run Payroll Card */}
          {isAdmin && (
            <div className="bg-white rounded-[28px] border border-[#f1f5f9] shadow-[0_2px_8px_rgba(0,0,0,0.02)] p-6">
              <h2 className="text-lg font-bold text-[#2D2A24] mb-4">Run Payroll</h2>
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Month</label>
                  <select value={runMonth} onChange={e => setRunMonth(Number(e.target.value))}
                    className="input text-sm min-w-[140px]">
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Year</label>
                  <select value={runYear} onChange={e => setRunYear(Number(e.target.value))}
                    className="input text-sm min-w-[100px]">
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <button onClick={() => runPayrollMutation.mutate({ year: runYear, month: runMonth })}
                  disabled={runPayrollMutation.isPending}
                  className="btn-primary px-6 py-2.5 text-sm font-bold flex items-center gap-2 disabled:opacity-50">
                  {runPayrollMutation.isPending ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Running…</>
                  ) : 'Run Payroll'}
                </button>
              </div>
            </div>
          )}

          {loadingRuns ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-[var(--color-text-secondary)]">Loading payroll data…</span>
            </div>
          ) : payrollRuns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-[28px] border border-[#f1f5f9]">
              <div className="text-5xl mb-4">💰</div>
              <h3 className="text-lg font-bold text-[#2D2A24] mb-1">No payroll runs yet</h3>
              <p className="text-sm font-medium text-[#8A8680]">Run payroll to see data here.</p>
            </div>
          ) : (
            <>
              {/* Latest Run Summary */}
              {latestRun && (
                <div className="bg-white rounded-[28px] border border-[#f1f5f9] shadow-[0_2px_8px_rgba(0,0,0,0.02)] p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-[#2D2A24]">
                      {MONTHS[(latestRun.month || 1) - 1]} {latestRun.year} Run
                    </h2>
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
                      latestRun.is_finalized ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200'
                    }`}>
                      {latestRun.is_finalized ? '✓ Finalized' : 'Draft'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: 'Employees', value: latestRun.total_employees || 0, color: 'bg-blue-50 text-blue-700' },
                      { label: 'Gross Pay', value: fmtCurrency(latestRun.total_gross), color: 'bg-emerald-50 text-emerald-700' },
                      { label: 'Deductions', value: fmtCurrency(latestRun.total_deductions), color: 'bg-red-50 text-red-700' },
                      { label: 'Net Pay', value: fmtCurrency(latestRun.total_net), color: 'bg-purple-50 text-purple-700' },
                    ].map(s => (
                      <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
                        <p className="text-xs font-medium opacity-70 mb-1">{s.label}</p>
                        <p className="text-lg font-bold">{s.value}</p>
                      </div>
                    ))}
                  </div>
                  {isAdmin && !latestRun.is_finalized && (
                    <div className="mt-5 pt-4 border-t border-[#f1f5f9]">
                      <button onClick={() => {
                        if (window.confirm('Finalize this payroll run? This cannot be undone.')) {
                          finalizeMutation.mutate(latestRun.id);
                        }
                      }}
                        disabled={finalizeMutation.isPending}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50 cursor-pointer">
                        {finalizeMutation.isPending ? 'Finalizing…' : 'Finalize Payroll'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Run History */}
              <div>
                <h2 className="text-base font-bold text-[#2D2A24] mb-4">Run History</h2>
                <div className="bg-white rounded-[28px] border border-[#f1f5f9] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#F7F9FC] border-b border-[#f1f5f9]">
                          <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">Period</th>
                          <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">Employees</th>
                          <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">Gross</th>
                          <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">Deductions</th>
                          <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">Net Pay</th>
                          <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">Status</th>
                          <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f1f5f9]">
                        {sortedRuns.map(run => (
                          <tr key={run.id} onClick={() => { setSelectedRun(run.id); setTab('records'); }}
                            className="hover:bg-[#F7F9FC]/50 cursor-pointer transition-colors">
                            <td className="px-5 py-4 font-semibold text-[#2D2A24]">{MONTHS[(run.month || 1) - 1]} {run.year}</td>
                            <td className="px-5 py-4 text-[#8A8680]">{run.total_employees || 0}</td>
                            <td className="px-5 py-4 text-[#8A8680]">{fmtCurrency(run.total_gross)}</td>
                            <td className="px-5 py-4 text-[#8A8680]">{fmtCurrency(run.total_deductions)}</td>
                            <td className="px-5 py-4 font-semibold text-[#2D2A24]">{fmtCurrency(run.total_net)}</td>
                            <td className="px-5 py-4">
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                                run.is_finalized ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200'
                              }`}>
                                {run.is_finalized ? 'Finalized' : 'Draft'}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-[#8A8680] text-xs">{fmtDate(run.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════
          PAYROLL RECORDS TAB
          ═══════════════════════════════════════════════════════════ */}
      {tab === 'records' && (
        <>
          {/* Run selector */}
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Payroll Run</label>
              <select value={selectedRun} onChange={e => setSelectedRun(e.target.value)}
                className="input text-sm min-w-[220px]">
                <option value="">Select a run</option>
                {sortedRuns.map(r => (
                  <option key={r.id} value={r.id}>
                    {MONTHS[(r.month || 1) - 1]} {r.year} ({r.is_finalized ? 'Finalized' : 'Draft'})
                  </option>
                ))}
              </select>
            </div>
            {activeRun && (
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full border mt-5 ${
                activeRun.is_finalized ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200'
              }`}>
                {activeRun.is_finalized ? '✓ Finalized' : 'Draft'}
              </span>
            )}
          </div>

          {!selectedRun ? (
            <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-[28px] border border-[#f1f5f9]">
              <div className="text-5xl mb-4">📋</div>
              <h3 className="text-lg font-bold text-[#2D2A24] mb-1">Select a payroll run</h3>
              <p className="text-sm font-medium text-[#8A8680]">Choose from the dropdown above to view detailed records.</p>
            </div>
          ) : loadingRecords ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-[var(--color-text-secondary)]">Loading records…</span>
            </div>
          ) : payrollRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-[28px] border border-[#f1f5f9]">
              <div className="text-5xl mb-4">📄</div>
              <h3 className="text-lg font-bold text-[#2D2A24] mb-1">No records found</h3>
              <p className="text-sm font-medium text-[#8A8680]">This run has no payroll records yet.</p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-4 gap-4">
                {(() => {
                  const totalGross = payrollRecords.reduce((s, r) => s + Number(r.gross_pay || 0), 0);
                  const totalPF = payrollRecords.reduce((s, r) => s + Number(r.pf_deduction || 0), 0);
                  const totalESIC = payrollRecords.reduce((s, r) => s + Number(r.esic_deduction || 0), 0);
                  const totalLOP = payrollRecords.reduce((s, r) => s + Number(r.lop_deduction || 0), 0);
                  const totalDed = payrollRecords.reduce((s, r) => s + Number(r.total_deductions || 0), 0);
                  const totalNet = payrollRecords.reduce((s, r) => s + Number(r.net_pay || 0), 0);
                  return [
                    { label: 'Total Gross', value: fmtCurrency(totalGross), color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                    { label: 'PF (12%)', value: fmtCurrency(totalPF), color: 'bg-blue-50 text-blue-700 border-blue-200' },
                    { label: 'ESIC (0.75%)', value: fmtCurrency(totalESIC), color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
                    { label: 'LOP', value: fmtCurrency(totalLOP), color: 'bg-amber-50 text-amber-700 border-amber-200' },
                    { label: 'Total Deductions', value: fmtCurrency(totalDed), color: 'bg-red-50 text-red-700 border-red-200' },
                    { label: 'Net Pay', value: fmtCurrency(totalNet), color: 'bg-purple-50 text-purple-700 border-purple-200' },
                  ].map(s => (
                    <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
                      <p className="text-xs font-medium opacity-70 mb-1">{s.label}</p>
                      <p className="text-lg font-bold">{s.value}</p>
                    </div>
                  ));
                })()}
              </div>

              {/* Records table */}
              <div className="bg-white rounded-[28px] border border-[#f1f5f9] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#F7F9FC] border-b border-[#f1f5f9]">
                        <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">Employee</th>
                        <th className="text-right px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">Gross</th>
                        <th className="text-right px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">PF (12%)</th>
                        <th className="text-right px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">ESIC (0.75%)</th>
                        <th className="text-right px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">LOP</th>
                        <th className="text-right px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">Total Ded.</th>
                        <th className="text-right px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">Net Pay</th>
                        <th className="text-right px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">Days</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f5f9]">
                      {payrollRecords.map(rec => (
                        <tr key={rec.id} className="hover:bg-[#F7F9FC]/50 transition-colors">
                          <td className="px-5 py-4 font-semibold text-[#2D2A24]">{rec.staff_name || rec.staff_id || '—'}</td>
                          <td className="px-5 py-4 text-right font-medium text-[#2D2A24]">{fmtCurrency(rec.gross_pay)}</td>
                          <td className="px-5 py-4 text-right text-[#8A8680]">{fmtCurrency(rec.pf_deduction)}</td>
                          <td className="px-5 py-4 text-right text-[#8A8680]">{fmtCurrency(rec.esic_deduction)}</td>
                          <td className="px-5 py-4 text-right text-[#8A8680]">{fmtCurrency(rec.lop_deduction)}</td>
                          <td className="px-5 py-4 text-right text-red-600 font-medium">{fmtCurrency(rec.total_deductions)}</td>
                          <td className="px-5 py-4 text-right font-bold text-[#2D2A24]">{fmtCurrency(rec.net_pay)}</td>
                          <td className="px-5 py-4 text-right text-[#8A8680]">{rec.days_worked || 0}{rec.lop_days ? ` (LOP: ${rec.lop_days})` : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════
          SALARY SLIPS TAB
          ═══════════════════════════════════════════════════════════ */}
      {tab === 'slips' && (
        <>
          <p className="text-sm font-medium text-[#8A8680]">{salarySlips.length} salary slips</p>

          {loadingSlips ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-[var(--color-text-secondary)]">Loading salary slips…</span>
            </div>
          ) : salarySlips.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-[28px] border border-[#f1f5f9]">
              <div className="text-5xl mb-4">📄</div>
              <h3 className="text-lg font-bold text-[#2D2A24] mb-1">No salary slips</h3>
              <p className="text-sm font-medium text-[#8A8680]">Run payroll to generate salary slips.</p>
            </div>
          ) : (
            <div className="bg-white rounded-[28px] border border-[#f1f5f9] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#F7F9FC] border-b border-[#f1f5f9]">
                      <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">Employee</th>
                      <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">Period</th>
                      <th className="text-right px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">Gross</th>
                      <th className="text-right px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">Deductions</th>
                      <th className="text-right px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">Net Pay</th>
                      <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">Status</th>
                      <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">Generated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9]">
                    {salarySlips.map(slip => (
                      <tr key={slip.id} className="hover:bg-[#F7F9FC]/50 transition-colors">
                        <td className="px-5 py-4 font-semibold text-[#2D2A24]">{slip.staff_name || slip.staff_id || '—'}</td>
                        <td className="px-5 py-4 text-[#8A8680]">{MONTHS[(slip.month || 1) - 1]} {slip.year}</td>
                        <td className="px-5 py-4 text-right font-medium text-[#2D2A24]">{fmtCurrency(slip.gross_pay)}</td>
                        <td className="px-5 py-4 text-right text-red-600">{fmtCurrency(slip.total_deductions)}</td>
                        <td className="px-5 py-4 text-right font-bold text-[#2D2A24]">{fmtCurrency(slip.net_pay)}</td>
                        <td className="px-5 py-4">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                            slip.status === 'Submitted' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                            slip.status === 'Draft' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {slip.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-[#8A8680] text-xs">{fmtDate(slip.generated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
