import { useState } from 'react';
import { useFeesWithPayments, useStudentPayments, useAllStudents, useConcessionRequests, getFeeStatus, FEE_STATUS_STYLES, INR, fmtDate } from '../../hooks/useFees';
import StatusBadge from './StatusBadge';

export default function FeeStudentView() {
  const [selectedStudent, setSelectedStudent] = useState('');
  const [search, setSearch] = useState('');

  const [dismissed, setDismissed] = useState(new Set());

  const { data: students = [], error: studentsError, refetch: refetchStudents } = useAllStudents();

  const filteredStudents = students.filter(s => {
    const q = search.toLowerCase();
    return !search || s.student_name?.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q);
  });

  const selectedStudentData = students.find(s => s.name === selectedStudent);

  return (
    <div className="space-y-5">
      {/* Error Banner */}
      {studentsError && !dismissed.has('students') && (
        <div className="flex items-center justify-between gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm">
          <div className="flex items-center gap-2">
            <span className="text-red-500 font-bold">!</span>
            <span className="text-red-700">{studentsError?.readableMessage || 'Failed to load students'}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => refetchStudents()}
              className="px-3 py-1 text-xs font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition">
              Retry
            </button>
            <button onClick={() => setDismissed(d => new Set(d).add('students'))}
              className="text-red-400 hover:text-red-600 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Student Selector */}
      <div className="card">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[250px] relative">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Select Student</label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" placeholder="Search by name or ID..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="input pl-9 text-sm" />
            </div>
            {search && filteredStudents.length > 0 && !selectedStudent && (
              <div className="absolute z-10 mt-1 w-full bg-white rounded-xl border shadow-lg max-h-60 overflow-y-auto">
                {filteredStudents.slice(0, 20).map(s => (
                  <button key={s.name}
                    onClick={() => { setSelectedStudent(s.name); setSearch(''); }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 border-b border-gray-50 last:border-0 transition">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] font-bold text-sm shrink-0">
                      {(s.student_name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text)]">{s.student_name}</p>
                      <p className="text-xs text-gray-400">{s.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedStudentData && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] font-bold">
                {(selectedStudentData.student_name || '?')[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)]">{selectedStudentData.student_name}</p>
                <p className="text-xs text-gray-400">{selectedStudentData.name} {selectedStudentData.program ? `• ${selectedStudentData.program}` : ''}</p>
              </div>
              <button onClick={() => setSelectedStudent('')}
                className="ml-2 text-gray-400 hover:text-gray-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Ledger */}
      {selectedStudent ? (
        <StudentLedger studentId={selectedStudent} customerName={selectedStudentData?.customer || selectedStudent} />
      ) : (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center text-4xl mb-4 border border-blue-100">👤</div>
          <p className="font-bold text-[var(--color-text)] text-lg">Select a student</p>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1 max-w-xs">
            Search and select a student to view their complete fee ledger, payment history, and outstanding balance.
          </p>
        </div>
      )}
    </div>
  );
}

function StudentLedger({ studentId, customerName }) {
  const [dismissed, setDismissed] = useState(new Set());
  const { data: enrichedFees = [], isLoading: loadingFees, error: feesError, refetch: refetchFees } = useFeesWithPayments([['student', '=', studentId]]);
  const { data: payments = [], isLoading: loadingPayments, error: paymentsError, refetch: refetchPayments } = useStudentPayments(customerName);
  const { data: concessions = [] } = useConcessionRequests([['student', '=', studentId], ['status', '=', 'Approved']]);

  const errors = [
    feesError && !dismissed.has('fees') && { key: 'fees', msg: feesError?.readableMessage || 'Failed to load fee history', retry: () => refetchFees() },
    paymentsError && !dismissed.has('payments') && { key: 'payments', msg: paymentsError?.readableMessage || 'Failed to load payment history', retry: () => refetchPayments() },
  ].filter(Boolean);

  if (loadingFees || loadingPayments) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-10 h-10 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[var(--color-text-secondary)]">Loading fee history...</p>
      </div>
    );
  }

  const feesWithStatus = enrichedFees.map(f => ({ ...f, _status: getFeeStatus(f) }));
  const totalBilled = feesWithStatus.reduce((s, f) => s + (f.grand_total || 0), 0);
  const totalOutstanding = feesWithStatus.reduce((s, f) => s + (f.effective_outstanding || 0), 0);
  const totalPaid = totalBilled - totalOutstanding;

  return (
    <div className="space-y-5">
      {/* Error Banners */}
      {errors.length > 0 && (
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border bg-gradient-to-br from-[#E8F9ED] to-[#BBF7D0] text-[#2ED05D] border-[#BBF7D0] p-4">
          <div className="text-2xl font-bold leading-tight">{INR(totalBilled)}</div>
          <div className="text-xs font-medium opacity-70 mt-1">Total Billed</div>
          <div className="text-xs opacity-50 mt-0.5">{feesWithStatus.length} invoices</div>
        </div>
        <div className="rounded-2xl border bg-gradient-to-br from-emerald-50 to-green-100 text-emerald-700 border-emerald-200 p-4">
          <div className="text-2xl font-bold leading-tight">{INR(totalPaid)}</div>
          <div className="text-xs font-medium opacity-70 mt-1">Total Paid</div>
          <div className="text-xs opacity-50 mt-0.5">{payments.length} payments</div>
        </div>
        <div className="rounded-2xl border bg-gradient-to-br from-red-50 to-rose-100 text-red-700 border-red-200 p-4">
          <div className="text-2xl font-bold leading-tight">{INR(totalOutstanding)}</div>
          <div className="text-xs font-medium opacity-70 mt-1">Outstanding</div>
          <div className="text-xs opacity-50 mt-0.5">{feesWithStatus.filter(f => f._status !== 'Paid').length} unpaid</div>
        </div>
        <div className="rounded-2xl border bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-700 border-emerald-200 p-4">
          <div className="text-2xl font-bold leading-tight">
            {feesWithStatus.filter(f => f._status === 'Overdue').length}
          </div>
          <div className="text-xs font-medium opacity-70 mt-1">Overdue</div>
          <div className="text-xs opacity-50 mt-0.5">past due date</div>
        </div>
      </div>

      {/* Collection Progress */}
      {totalBilled > 0 && (
        <div className="card !py-4">
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="font-semibold text-[var(--color-text)]">Payment Progress</span>
            <span className="font-bold text-emerald-600">
              {Math.round((totalPaid / totalBilled) * 100)}% paid
            </span>
          </div>
          <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${Math.round((totalPaid / totalBilled) * 100)}%` }} />
          </div>
        </div>
      )}

      {/* Fee History */}
      <div className="card !p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-[var(--color-text)]">Fee History</h3>
        </div>
        {feesWithStatus.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">No fee records for this student</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Invoice', 'Program', 'Year', 'Total', 'Outstanding', 'Due Date', 'Status'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {feesWithStatus.map(fee => {
                  const st = FEE_STATUS_STYLES[fee._status] || FEE_STATUS_STYLES.Unpaid;
                  return (
                    <tr key={fee.name} className={st.row}>
                      <td className="px-5 py-3.5 text-sm font-semibold text-[var(--color-primary)] whitespace-nowrap">{fee.name}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">{fee.program || '—'}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">{fee.academic_year || '—'}</td>
                      <td className="px-5 py-3.5 text-sm font-semibold text-[var(--color-text)] whitespace-nowrap">{INR(fee.grand_total)}</td>
                      <td className="px-5 py-3.5 text-sm whitespace-nowrap">
                        <span className={fee.effective_outstanding > 0 ? 'font-semibold text-red-600' : 'text-emerald-600 font-semibold'}>
                          {INR(fee.effective_outstanding)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">{fmtDate(fee.due_date)}</td>
                      <td className="px-5 py-3.5"><StatusBadge status={fee._status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment History */}
      <div className="card !p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-[var(--color-text)]">Payment History</h3>
        </div>
        {payments.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">No payments recorded for this student</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Payment ID', 'Date', 'Amount', 'Mode', 'Reference', 'Status'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payments.map(p => (
                  <tr key={p.name}>
                    <td className="px-5 py-3.5 text-sm font-semibold text-emerald-600 whitespace-nowrap">{p.name}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">{fmtDate(p.posting_date)}</td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-[var(--color-text)] whitespace-nowrap">{INR(p.paid_amount)}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                        {p.mode_of_payment || 'N/A'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">{p.reference_no || '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                        p.docstatus === 1
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                          : 'bg-gray-100 text-gray-600 border-gray-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${p.docstatus === 1 ? 'bg-emerald-400' : 'bg-gray-400'}`} />
                        {p.docstatus === 1 ? 'Submitted' : 'Draft'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Approved Concessions */}
      {concessions.length > 0 && (
        <div className="card !p-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <span className="text-blue-600 text-sm">%</span>
            </div>
            <div>
              <h3 className="font-bold text-[var(--color-text)]">Approved Concessions</h3>
              <p className="text-xs text-gray-400">{concessions.length} concession{concessions.length !== 1 ? 's' : ''} applied</p>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {concessions.map(c => (
              <div key={c.name} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text)]">{c.reason_category}</p>
                  <p className="text-xs text-gray-400">{c.reason}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Requested by {c.requested_by} · Approved by {c.approved_by} · {fmtDate(c.approval_date)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-600">-{INR(c.concession_amount)}</p>
                  <p className="text-xs text-gray-400">{c.fees}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
