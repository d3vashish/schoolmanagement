import { useState } from 'react';
import { useAcademicYear } from '../../context/AcademicYearContext';
import { useQueryClient } from '@tanstack/react-query';
import {
  useFeesWithPayments, useFeeStructures, useUpdateFee,
  getFeeStatus, FEE_STATUS_STYLES, INR, fmtDate,
  calcLateFee, isLateFeeApplicable, hasLateFeeApplied,
} from '../../hooks/useFees';
import StatusBadge from './StatusBadge';
import CreateFeeModal from './CreateFeeModal';
import ConcessionRequestModal from './ConcessionRequestModal';
import RecordPaymentModal from './RecordPaymentModal';

export default function FeeInvoices() {
  const { selectedYear } = useAcademicYear();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterProgram, setFilterProgram] = useState('');
  const [selected, setSelected] = useState(null);
  const [sortBy, setSortBy] = useState('due_date');
  const [view, setView] = useState('table');
  const [showCreate, setShowCreate] = useState(false);

  const [dismissed, setDismissed] = useState(false);
  const [lateFeeTarget, setLateFeeTarget] = useState(null); // { fee, amount, category }
  const [concessionTarget, setConcessionTarget] = useState(null); // { student, fees }
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [lateFeeError, setLateFeeError] = useState('');

  const yearFilter = selectedYear ? [['academic_year', '=', selectedYear]] : [];
  const { data: fees = [], isLoading: loading, error, refetch } = useFeesWithPayments(yearFilter);
  const { data: structures = [] } = useFeeStructures(yearFilter);
  const structureMap = Object.fromEntries(structures.map(s => [s.name, s]));
  const updateFee = useUpdateFee();

  const applyLateFee = async ({ fee, amount, category }) => {
    try {
      setLateFeeError('');
      const { getDoc } = await import('../../api/frappe');
      const fullFee = await getDoc('Fees', fee.name);
      const fs = structureMap[fee.fee_structure];
      if (hasLateFeeApplied(fullFee, fs)) {
        setLateFeeError('Late fee has already been applied to this invoice.');
        return;
      }
      const existingComponents = (fullFee.components || []).map(c => ({
        doctype: 'Fee Component',
        fees_category: c.fees_category,
        amount: c.amount,
        discount: c.discount || 0,
        total: c.total || c.amount,
        item: c.item || c.fees_category,
      }));
      const newComponent = {
        doctype: 'Fee Component',
        fees_category: category,
        amount: amount,
        discount: 0,
        total: amount,
        item: category,
      };
      await updateFee.mutateAsync({
        name: fee.name,
        data: { components: [...existingComponents, newComponent] },
      });
    } catch (err) {
      setLateFeeError(err.readableMessage || 'Failed to apply late fee.');
    }
  };

  const programs = [...new Set(fees.map(f => f.program).filter(Boolean))].sort((a, b) => {
    const n = s => parseInt((s || '').match(/\d+/)?.[0] || 0);
    return n(a) - n(b);
  });

  const enriched = fees.map(f => ({ ...f, _status: getFeeStatus(f) }));
  const filtered = enriched
    .filter(f => {
      const q = search.toLowerCase();
      const matchQ = !search || f.student_name?.toLowerCase().includes(q) || f.name?.toLowerCase().includes(q);
      const matchS = filterStatus === 'all' || f._status === filterStatus;
      const matchP = !filterProgram || f.program === filterProgram;
      return matchQ && matchS && matchP;
    })
    .sort((a, b) => {
      if (sortBy === 'due_date')    return (a.due_date || '').localeCompare(b.due_date || '');
      if (sortBy === 'amount')      return (b.grand_total || 0) - (a.grand_total || 0);
      if (sortBy === 'outstanding') return (b.effective_outstanding || 0) - (a.effective_outstanding || 0);
      return a.name.localeCompare(b.name);
    });

  const totalGrand       = fees.reduce((s, f) => s + (f.grand_total || 0), 0);
  const totalOutstanding = fees.reduce((s, f) => s + (f.effective_outstanding || 0), 0);
  const totalCollected   = totalGrand - totalOutstanding;
  const collectionRate   = totalGrand > 0 ? Math.round((totalCollected / totalGrand) * 100) : 0;
  const paidCount        = enriched.filter(f => f._status === 'Paid').length;

  return (
    <div className="space-y-5">
      {/* Error Banner */}
      {error && !dismissed && (
        <div className="flex items-center justify-between gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm">
          <div className="flex items-center gap-2">
            <span className="text-red-500 font-bold">!</span>
            <span className="text-red-700">{error?.readableMessage || 'Failed to load invoices'}</span>
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

      {/* Late Fee Error Banner */}
      {lateFeeError && (
        <div className="flex items-center justify-between gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm">
          <div className="flex items-center gap-2">
            <span className="text-emerald-500 font-bold">!</span>
            <span className="text-emerald-700">{lateFeeError}</span>
          </div>
          <button onClick={() => setLateFeeError('')} className="text-emerald-400 hover:text-emerald-600 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Billed',  value: INR(totalGrand),       sub: `${fees.length} invoices`,            color: 'from-[#E8F9ED] to-[#BBF7D0] text-[#2ED05D] border-[#BBF7D0]' },
          { label: 'Collected',     value: INR(totalCollected),   sub: `${collectionRate}% collection rate`,  color: 'from-emerald-50 to-green-100 text-emerald-700 border-emerald-200' },
          { label: 'Outstanding',   value: INR(totalOutstanding), sub: `${fees.length - paidCount} unpaid`,   color: 'from-red-50 to-rose-100 text-red-700 border-red-200' },
          { label: 'Overdue',       value: enriched.filter(f => f._status === 'Overdue').length, sub: 'past due date', color: 'from-emerald-50 to-emerald-100 text-emerald-700 border-emerald-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border bg-gradient-to-br p-4 ${s.color}`}>
            <div className="text-2xl font-bold leading-tight">{s.value}</div>
            <div className="text-xs font-medium opacity-70 mt-1">{s.label}</div>
            <div className="text-xs opacity-50 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Collection progress */}
      {totalGrand > 0 && (
        <div className="card !py-4">
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="font-semibold text-[var(--color-text)]">Collection Progress</span>
            <span className="font-bold text-emerald-600">{collectionRate}% collected</span>
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="Search student or invoice..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="input pl-9 text-sm" />
        </div>

        <div className="flex rounded-xl overflow-hidden border border-gray-200 shadow-sm">
          {['all', 'Paid', 'Unpaid', 'Partial', 'Overdue'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 text-xs font-semibold transition-all ${
                filterStatus === s ? 'bg-[var(--color-primary)] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>

        {programs.length > 0 && (
          <select value={filterProgram} onChange={e => setFilterProgram(e.target.value)}
            className="input text-sm w-auto min-w-[140px]">
            <option value="">All Programs</option>
            {programs.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}

        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          className="input text-sm w-auto min-w-[150px]">
          <option value="due_date">Sort: Due Date</option>
          <option value="amount">Sort: Amount</option>
          <option value="outstanding">Sort: Outstanding</option>
          <option value="name">Sort: Invoice #</option>
        </select>

        <div className="flex rounded-xl overflow-hidden border border-gray-200 ml-auto">
          {[{ k: 'table', icon: '≡' }, { k: 'cards', icon: '⊞' }].map(({ k, icon }) => (
            <button key={k} onClick={() => setView(k)}
              className={`px-3 py-2 text-sm transition-all ${
                view === k ? 'bg-[var(--color-primary)] text-white' : 'bg-white text-gray-400 hover:bg-gray-50'
              }`}>
              {icon}
            </button>
          ))}
        </div>

        <span className="text-sm text-[var(--color-text-secondary)]">
          {filtered.length} record{filtered.length !== 1 ? 's' : ''}
        </span>

        <button onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-2 text-sm px-4 py-2.5 group">
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center transition-all duration-300 group-hover:bg-white/30 group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </span>
          New Invoice
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-28 gap-3">
          <div className="w-10 h-10 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--color-text-secondary)]">Loading fee records...</p>
        </div>
      ) : fees.length === 0 ? (
        <EmptyState onNew={() => setShowCreate(true)} />
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <p className="font-semibold text-[var(--color-text)]">No records match your filters</p>
          <button onClick={() => { setSearch(''); setFilterStatus('all'); setFilterProgram(''); }}
            className="mt-3 text-sm text-[var(--color-primary)] hover:underline">Clear filters</button>
        </div>
      ) : view === 'table' ? (
        <TableView fees={filtered} onSelect={setSelected} structureMap={structureMap} onLateFee={setLateFeeTarget} onConcession={setConcessionTarget} onPayment={setPaymentTarget} />
      ) : (
        <CardsView fees={filtered} onSelect={setSelected} structureMap={structureMap} onLateFee={setLateFeeTarget} onConcession={setConcessionTarget} onPayment={setPaymentTarget} />
      )}

      {/* Detail panel */}
      {selected && <DetailPanel fee={selected} onClose={() => setSelected(null)} />}

      {/* Create Fee Modal */}
      {showCreate && (
        <CreateFeeModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: ['Fees'] });
          }}
        />
      )}

      {/* Late Fee Confirmation Dialog */}
      {lateFeeTarget && (
        <LateFeeConfirmDialog
          fee={lateFeeTarget.fee}
          amount={lateFeeTarget.amount}
          category={lateFeeTarget.category}
          onConfirm={() => { applyLateFee(lateFeeTarget); setLateFeeTarget(null); }}
          onCancel={() => setLateFeeTarget(null)}
        />
      )}

      {/* Concession Request Modal */}
      {concessionTarget && (
        <ConcessionRequestModal
          studentId={concessionTarget.student}
          feesName={concessionTarget.fees}
          onClose={() => setConcessionTarget(null)}
          onCreated={() => { setConcessionTarget(null); queryClient.invalidateQueries({ queryKey: ['Fee Concession Request'] }); }}
        />
      )}
      {paymentTarget && (
        <RecordPaymentModal
          studentId={paymentTarget}
          onClose={() => setPaymentTarget(null)}
          onSaved={() => {
            setPaymentTarget(null);
            queryClient.invalidateQueries({ queryKey: ['Fees'] });
          }}
        />
      )}
    </div>
  );
}

// ── Late Fee Confirm Dialog ──────────────────────────────────────────────────

function LateFeeConfirmDialog({ fee, amount, category, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
            <span className="text-emerald-600 text-lg font-bold">!</span>
          </div>
          <div>
            <h3 className="font-bold text-[var(--color-text)]">Apply Late Fee</h3>
            <p className="text-xs text-gray-400">This action cannot be undone</p>
          </div>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 mb-5 text-sm space-y-1.5">
          <div className="flex justify-between">
            <span className="text-gray-500">Invoice</span>
            <span className="font-semibold">{fee.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Student</span>
            <span className="font-semibold">{fee.student_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Category</span>
            <span className="font-semibold">{category}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-1.5 mt-1.5">
            <span className="text-gray-500">Late Fee Amount</span>
            <span className="font-bold text-emerald-600">{INR(amount)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 justify-end">
          <button onClick={onCancel}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="btn-primary px-5 py-2.5 text-sm font-medium">
            Apply Late Fee
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Table View ──────────────────────────────────────────────────────────────

function TableView({ fees, onSelect, structureMap, onLateFee, onConcession, onPayment }) {
  return (
    <div className="card !p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {['Invoice', 'Student', 'Program', 'Amount', 'Outstanding', 'Due Date', 'Status', ''].map(h => (
                <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {fees.map(fee => {
              const st = FEE_STATUS_STYLES[fee._status] || FEE_STATUS_STYLES.Unpaid;
              return (
                <tr key={fee.name} onClick={() => onSelect(fee)}
                  className={`hover:bg-[var(--color-primary)]/5 transition-colors cursor-pointer ${st.row}`}>
                  <td className="px-5 py-4 text-sm font-semibold text-[var(--color-primary)] whitespace-nowrap">{fee.name}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] font-bold text-sm shrink-0">
                        {(fee.student_name || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--color-text)] whitespace-nowrap">{fee.student_name}</p>
                        <p className="text-xs text-gray-400">{fee.student}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-500 whitespace-nowrap">{fee.program || '—'}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-[var(--color-text)] whitespace-nowrap">{INR(fee.grand_total)}</td>
                  <td className="px-5 py-4 text-sm whitespace-nowrap">
                    <span className={fee.effective_outstanding > 0 ? 'font-semibold text-red-600' : 'text-emerald-600 font-semibold'}>
                      {INR(fee.effective_outstanding)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-500 whitespace-nowrap">{fmtDate(fee.due_date)}</td>
                  <td className="px-5 py-4"><StatusBadge status={fee._status} /></td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const fs = structureMap[fee.fee_structure];
                        if (!isLateFeeApplicable(fee, fs)) return null;
                        const amt = calcLateFee(fs, fee.effective_outstanding);
                        return (
                          <button onClick={e => { e.stopPropagation(); onLateFee({ fee, amount: amt, category: fs.late_fee_category }); }}
                            className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 hover:bg-emerald-100 transition whitespace-nowrap">
                            Late Fee
                          </button>
                        );
                      })()}
                      {(fee._status === 'Unpaid' || fee._status === 'Partial' || fee._status === 'Overdue') && (fee.effective_outstanding || 0) > 0 && (
                        <button onClick={e => { e.stopPropagation(); onConcession({ student: fee.student, fees: fee.name }); }}
                          className="text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-100 transition whitespace-nowrap">
                          Concession
                        </button>
                      )}
                        {(fee._status === 'Unpaid' || fee._status === 'Partial' || fee._status === 'Overdue') && (fee.effective_outstanding || 0) > 0 && (
                          <button onClick={e => { e.stopPropagation(); onPayment?.(fee.student); }}
                            className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 hover:bg-emerald-100 transition whitespace-nowrap">
                            Pay
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Cards View ──────────────────────────────────────────────────────────────

function CardsView({ fees, onSelect, structureMap, onLateFee, onConcession, onPayment }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {fees.map(fee => {
        const pct = fee.grand_total > 0
          ? Math.round(((fee.grand_total - fee.effective_outstanding) / fee.grand_total) * 100) : 0;
        return (
          <div key={fee.name} onClick={() => onSelect(fee)}
            className="p-5 rounded-2xl border bg-white hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-[var(--color-primary)] font-semibold">{fee.name}</p>
                <p className="font-bold text-[var(--color-text)] mt-0.5">{fee.student_name}</p>
                {fee.program && <p className="text-xs text-gray-400 mt-0.5">{fee.program}</p>}
              </div>
              <StatusBadge status={fee._status} />
            </div>
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-xs text-gray-400">Total</p>
                <p className="text-xl font-bold text-[var(--color-text)]">{INR(fee.grand_total)}</p>
              </div>
              {fee.effective_outstanding > 0 && (
                <div className="text-right">
                  <p className="text-xs text-gray-400">Outstanding</p>
                  <p className="text-base font-bold text-red-500">{INR(fee.effective_outstanding)}</p>
                </div>
              )}
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-2">
              <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>{pct}% paid</span>
              <span>Due {fmtDate(fee.due_date)}</span>
            </div>
            <div className="mt-3 space-y-2">
              {(() => {
                const fs = structureMap[fee.fee_structure];
                if (!isLateFeeApplicable(fee, fs)) return null;
                const amt = calcLateFee(fs, fee.effective_outstanding);
                return (
                  <button onClick={e => { e.stopPropagation(); onLateFee({ fee, amount: amt, category: fs.late_fee_category }); }}
                    className="w-full text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 hover:bg-emerald-100 transition">
                    Apply Late Fee — {INR(amt)}
                  </button>
                );
              })()}
              {(fee._status === 'Unpaid' || fee._status === 'Partial' || fee._status === 'Overdue') && (fee.effective_outstanding || 0) > 0 && (
                <button onClick={e => { e.stopPropagation(); onConcession({ student: fee.student, fees: fee.name }); }}
                  className="w-full text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 hover:bg-blue-100 transition">
                  Request Concession
                </button>
              )}
              {(fee._status === 'Unpaid' || fee._status === 'Partial' || fee._status === 'Overdue') && (fee.effective_outstanding || 0) > 0 && (
                <button onClick={e => { e.stopPropagation(); onPayment?.(fee.student); }}
                  className="w-full text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 hover:bg-emerald-100 transition">
                  Record Payment
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Detail Side Panel ───────────────────────────────────────────────────────

function DetailPanel({ fee, onClose }) {
  const pct = fee.grand_total > 0
    ? Math.round(((fee.grand_total - fee.effective_outstanding) / fee.grand_total) * 100) : 0;
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-end" onClick={onClose}>
      <div className="bg-white h-full w-full max-w-sm shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-[var(--color-primary)] font-semibold tracking-widest uppercase mb-1">{fee.name}</p>
              <h2 className="text-xl font-bold text-[var(--color-text)]">{fee.student_name || fee.student}</h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 mt-1 group">
              <span className="w-5 h-5 rounded-full bg-black/5 flex items-center justify-center group-hover:bg-black/10 transition-all duration-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
            </button>
          </div>
          <StatusBadge status={fee._status} />
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="rounded-2xl border border-gray-100 overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Amount</p>
            </div>
            {[
              { label: 'Total',       value: INR(fee.grand_total),        cls: 'font-bold text-[var(--color-text)]' },
              { label: 'Collected',   value: INR((fee.grand_total || 0) - (fee.effective_outstanding || 0)), cls: 'text-emerald-600 font-semibold' },
              { label: 'Outstanding', value: INR(fee.effective_outstanding), cls: fee.effective_outstanding > 0 ? 'text-red-600 font-semibold' : 'text-emerald-600' },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between px-4 py-3 text-sm border-b border-gray-50 last:border-0">
                <span className="text-gray-500">{r.label}</span>
                <span className={r.cls}>{r.value}</span>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-gray-100 overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Details</p>
            </div>
            {[
              { label: 'Program',       value: fee.program || '—' },
              { label: 'Academic Year', value: fee.academic_year || '—' },
              { label: 'Invoice Date',  value: fmtDate(fee.posting_date) },
              { label: 'Due Date',      value: fmtDate(fee.due_date) },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between px-4 py-3 text-sm border-b border-gray-50 last:border-0">
                <span className="text-gray-400">{r.label}</span>
                <span className="text-[var(--color-text)] font-medium">{r.value}</span>
              </div>
            ))}
          </div>
          {fee.grand_total > 0 && (
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-gray-400">Collection</span>
                <span className="font-semibold text-emerald-600">{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ onNew }) {
  return (
    <div className="card flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center text-4xl mb-4 border border-emerald-100">🧾</div>
      <p className="font-bold text-[var(--color-text)] text-lg">No fee records yet</p>
      <p className="text-sm text-[var(--color-text-secondary)] mt-1 max-w-xs">
        Create your first fee invoice to start tracking student payments.
      </p>
      <button onClick={onNew} className="mt-5 btn-primary text-sm px-5 py-2.5 flex items-center gap-2 group">
        <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center transition-all duration-300 group-hover:bg-white/30 group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </span>
        Create First Invoice
      </button>
    </div>
  );
}
