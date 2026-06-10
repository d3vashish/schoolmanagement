import { useState } from 'react';
import { useAcademicYear } from '../../context/AcademicYearContext';
import { useFeesWithPayments, usePayments, useFeeStructures, useConcessionRequests, getFeeStatus, INR, fmtDate, isLateFeeApplicable } from '../../hooks/useFees';
import StatusBadge from './StatusBadge';

export default function FeesOverview({ onNavigate }) {
  const { selectedYear } = useAcademicYear();
  const [dismissed, setDismissed] = useState(new Set());

  const yearFilter = selectedYear ? [['academic_year', '=', selectedYear]] : [];
  const { data: fees = [], isLoading: loadingFees, error: feesError, refetch: refetchFees } = useFeesWithPayments(yearFilter);
  const { data: payments = [], isLoading: loadingPayments, error: paymentsError, refetch: refetchPayments } = usePayments(
    [['payment_type', '=', 'Receive']],
  );
  const { data: structures = [] } = useFeeStructures(yearFilter);
  const structureMap = Object.fromEntries(structures.map(s => [s.name, s]));
  const { data: concessions = [] } = useConcessionRequests([['status', '=', 'Pending']]);
  const pendingConcessionCount = concessions.length;

  const errors = [
    feesError && !dismissed.has('fees') && { key: 'fees', msg: feesError?.readableMessage || 'Failed to load invoices', retry: () => refetchFees() },
    paymentsError && !dismissed.has('payments') && { key: 'payments', msg: paymentsError?.readableMessage || 'Failed to load payments', retry: () => refetchPayments() },
  ].filter(Boolean);

  if (loadingFees || loadingPayments) {
    return (
      <div className="flex flex-col items-center justify-center py-28 gap-3">
        <div className="w-10 h-10 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[var(--color-text-secondary)]">Loading overview...</p>
      </div>
    );
  }

  // Error banners
  const hasErrors = errors.length > 0;

  const enriched = fees.map(f => ({ ...f, _status: getFeeStatus(f) }));
  const totalBilled = fees.reduce((s, f) => s + (f.grand_total || 0), 0);
  const totalOutstanding = fees.reduce((s, f) => s + (f.effective_outstanding || 0), 0);
  const totalCollected = totalBilled - totalOutstanding;
  const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;
  const overdueCount = enriched.filter(f => f._status === 'Overdue').length;
  const paidCount = enriched.filter(f => f._status === 'Paid').length;
  const unpaidCount = enriched.filter(f => f._status === 'Unpaid').length;
  const partialCount = enriched.filter(f => f._status === 'Partial').length;
  const penaltyApplicableCount = fees.filter(f => isLateFeeApplicable(f, structureMap[f.fee_structure])).length;

  // This month's payments
  const now = new Date();
  const thisMonthPayments = payments.filter(p => {
    const d = new Date(p.posting_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const thisMonthCollected = thisMonthPayments.reduce((s, p) => s + (p.paid_amount || 0), 0);

  // Recent payments (last 10)
  const recentPayments = [...payments]
    .sort((a, b) => (b.posting_date || '').localeCompare(a.posting_date || ''))
    .slice(0, 10);

  // Overdue invoices (top 10 longest overdue)
  const overdueInvoices = enriched
    .filter(f => f._status === 'Overdue')
    .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
    .slice(0, 10);

  return (
    <div className="space-y-5">
      {/* Error Banners */}
      {hasErrors && (
        <div className="space-y-2">
          {errors.map(e => (
            <div key={e.key} className="flex items-center justify-between gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm">
              <div className="flex items-center gap-2">
                <span className="text-red-500 font-bold">!</span>
                <span className="text-red-700">{e.msg}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={e.retry}
                  className="px-3 py-1 text-xs font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition">
                  Retry
                </button>
                <button onClick={() => setDismissed(d => new Set(d).add(e.key))}
                  className="text-red-400 hover:text-red-600 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Primary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <button onClick={() => onNavigate?.('invoices')}
          className="rounded-2xl border bg-gradient-to-br from-[#E8F9ED] to-[#BBF7D0] text-[#2ED05D] border-[#BBF7D0] p-4 text-left hover:shadow-md transition-shadow">
          <div className="text-2xl font-bold leading-tight">{INR(totalBilled)}</div>
          <div className="text-xs font-medium opacity-70 mt-1">Total Billed</div>
          <div className="text-xs opacity-50 mt-0.5">{fees.length} invoices</div>
        </button>
        <button onClick={() => onNavigate?.('payments')}
          className="rounded-2xl border bg-gradient-to-br from-emerald-50 to-green-100 text-emerald-700 border-emerald-200 p-4 text-left hover:shadow-md transition-shadow">
          <div className="text-2xl font-bold leading-tight">{INR(totalCollected)}</div>
          <div className="text-xs font-medium opacity-70 mt-1">Collected</div>
          <div className="text-xs opacity-50 mt-0.5">{collectionRate}% collection rate</div>
        </button>
        <div className="rounded-2xl border bg-gradient-to-br from-red-50 to-rose-100 text-red-700 border-red-200 p-4">
          <div className="text-2xl font-bold leading-tight">{INR(totalOutstanding)}</div>
          <div className="text-xs font-medium opacity-70 mt-1">Outstanding</div>
          <div className="text-xs opacity-50 mt-0.5">{fees.length - paidCount} unpaid</div>
        </div>
        <div className="rounded-2xl border bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-700 border-emerald-200 p-4">
          <div className="text-2xl font-bold leading-tight">{overdueCount}</div>
          <div className="text-xs font-medium opacity-70 mt-1">Overdue</div>
          <div className="text-xs opacity-50 mt-0.5">past due date</div>
        </div>
        <div className="rounded-2xl border bg-gradient-to-br from-rose-50 to-red-100 text-rose-700 border-rose-200 p-4">
          <div className="text-2xl font-bold leading-tight">{penaltyApplicableCount}</div>
          <div className="text-xs font-medium opacity-70 mt-1">Penalty Applicable</div>
          <div className="text-xs opacity-50 mt-0.5">past grace, no fee yet</div>
        </div>
        <button onClick={() => onNavigate?.('concessions')}
          className="rounded-2xl border bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-700 border-blue-200 p-4 text-left hover:shadow-md transition-shadow">
          <div className="text-2xl font-bold leading-tight">{pendingConcessionCount}</div>
          <div className="text-xs font-medium opacity-70 mt-1">Pending Concessions</div>
          <div className="text-xs opacity-50 mt-0.5">awaiting approval</div>
        </button>
      </div>

      {/* Collection Progress */}
      {totalBilled > 0 && (
        <div className="card !py-4">
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="font-semibold text-[var(--color-text)]">Collection Progress</span>
            <span className="font-bold text-emerald-600">{collectionRate}%</span>
          </div>
          <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${collectionRate}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1.5">
            <span>{INR(totalCollected)} collected</span>
            <span>{INR(totalOutstanding)} remaining</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Status Distribution */}
        <div className="card">
          <h3 className="font-bold text-[var(--color-text)] mb-4">Invoice Status</h3>
          <div className="space-y-3">
            {[
              { label: 'Paid', count: paidCount, color: 'bg-emerald-400', pct: fees.length > 0 ? Math.round(paidCount / fees.length * 100) : 0 },
              { label: 'Partial', count: partialCount, color: 'bg-emerald-400', pct: fees.length > 0 ? Math.round(partialCount / fees.length * 100) : 0 },
              { label: 'Unpaid', count: unpaidCount, color: 'bg-red-400', pct: fees.length > 0 ? Math.round(unpaidCount / fees.length * 100) : 0 },
              { label: 'Overdue', count: overdueCount, color: 'bg-emerald-400', pct: fees.length > 0 ? Math.round(overdueCount / fees.length * 100) : 0 },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-3">
                <div className="w-16 text-xs text-gray-500 font-medium">{s.label}</div>
                <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-full rounded-full ${s.color}`} style={{ width: `${s.pct}%` }} />
                </div>
                <div className="w-20 text-right">
                  <span className="text-sm font-semibold text-[var(--color-text)]">{s.count}</span>
                  <span className="text-xs text-gray-400 ml-1">({s.pct}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* This Month */}
        <div className="card">
          <h3 className="font-bold text-[var(--color-text)] mb-4">This Month</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl">
              <div>
                <p className="text-xs text-emerald-600 font-medium">Collected</p>
                <p className="text-xl font-bold text-emerald-700">{INR(thisMonthCollected)}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
              <div>
                <p className="text-xs text-blue-600 font-medium">Payments</p>
                <p className="text-xl font-bold text-blue-700">{thisMonthPayments.length}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Payments */}
        <div className="card !p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-[var(--color-text)]">Recent Payments</h3>
            <button onClick={() => onNavigate?.('payments')}
              className="text-xs text-[var(--color-primary)] hover:underline font-medium">
              View All
            </button>
          </div>
          {recentPayments.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">No payments recorded yet</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentPayments.map(p => (
                <div key={p.name} className="px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-sm shrink-0">
                      {(p.party_name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text)]">{p.party_name || p.party}</p>
                      <p className="text-xs text-gray-400">{fmtDate(p.posting_date)}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600">+{INR(p.paid_amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Overdue Alerts */}
        <div className="card !p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-[var(--color-text)]">Overdue Alerts</h3>
            <button onClick={() => onNavigate?.('invoices')}
              className="text-xs text-[var(--color-primary)] hover:underline font-medium">
              View All
            </button>
          </div>
          {overdueInvoices.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">
              <div className="text-3xl mb-2">🎉</div>
              No overdue invoices!
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {overdueInvoices.map(f => (
                <div key={f.name} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text)]">{f.student_name}</p>
                    <p className="text-xs text-gray-400">{f.name} • Due {fmtDate(f.due_date)}</p>
                  </div>
                  <span className="text-sm font-semibold text-red-600">{INR(f.effective_outstanding)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h3 className="font-bold text-[var(--color-text)] mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            { label: 'Defaulters', icon: '⚠️', tab: 'defaulters', desc: 'View overdue students' },
            { label: 'Collections', icon: '📈', tab: 'collections', desc: 'Daily collection report' },
            { label: 'New Invoice', icon: '🧾', tab: 'invoices', desc: 'Create fee invoice' },
            { label: 'Record Payment', icon: '💰', tab: 'payments', desc: 'Record fee payment' },
            { label: 'Generate Fees', icon: '⚡', tab: 'invoices', desc: 'Batch generate from structure' },
            { label: 'View Structures', icon: '📋', tab: 'structures', desc: 'Manage fee templates' },
          ].map(a => (
            <button key={a.label} onClick={() => onNavigate?.(a.tab)}
              className="p-4 rounded-xl border border-gray-200 hover:bg-gray-50 hover:border-[var(--color-primary)]/30 transition-all text-left group">
              <div className="text-2xl mb-2">{a.icon}</div>
              <p className="text-sm font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">{a.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{a.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
