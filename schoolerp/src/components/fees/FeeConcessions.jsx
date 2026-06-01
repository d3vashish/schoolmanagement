import { useState, useMemo } from 'react';
import { useConcessionRequests, useUpdateConcessionRequest, useFeeDoc, useFees, INR, fmtDate } from '../../hooks/useFees';
import { useAcademicYear } from '../../context/AcademicYearContext';
import { useAuth } from '../../context/AuthContext';
import { createDoc } from '../../api/frappe';

const STATUS_FILTERS = ['All', 'Pending', 'Approved', 'Rejected'];
const STATUS_STYLES = {
  Pending:  { pill: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
  Approved: { pill: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400' },
  Rejected: { pill: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-400' },
};

export default function FeeConcessions() {
  const { selectedYear } = useAcademicYear();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);

  const { data: requests = [], isLoading, error, refetch } = useConcessionRequests();

  const canApprove = useMemo(() => {
    const roles = user?.roles || [];
    return roles.includes('Administrator') || roles.includes('Academics User');
  }, [user]);

  const filtered = useMemo(() => {
    let list = requests;
    if (statusFilter !== 'All') list = list.filter(r => r.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r => r.student_name?.toLowerCase().includes(q) || r.student?.toLowerCase().includes(q));
    }
    return list.sort((a, b) => (b.creation || '').localeCompare(a.creation || ''));
  }, [requests, statusFilter, search]);

  const pendingCount = requests.filter(r => r.status === 'Pending').length;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 gap-3">
        <div className="w-10 h-10 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[var(--color-text-secondary)]">Loading concession requests...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-lg text-[var(--color-text)]">Fee Concessions</h2>
          <p className="text-sm text-gray-400 mt-0.5">{pendingCount} pending request{pendingCount !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center justify-between gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm">
          <span className="text-red-700">{error?.readableMessage || 'Failed to load requests'}</span>
          <button onClick={() => refetch()} className="px-3 py-1 text-xs font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50">Retry</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input type="text" placeholder="Search by student..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="input text-sm w-60" />
        <div className="flex rounded-xl overflow-hidden border border-gray-200">
          {STATUS_FILTERS.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 text-sm font-medium transition-all ${
                statusFilter === s ? 'bg-[var(--color-primary)] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}>
              {s}{s === 'Pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
            </button>
          ))}
        </div>
        <span className="text-sm text-gray-400 ml-auto">{filtered.length} request{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <span className="text-2xl">%</span>
          </div>
          <p className="font-medium">No concession requests</p>
          <p className="text-sm">Requests will appear here when submitted from invoices</p>
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Student', 'Invoice', 'Type', 'Amount', 'Reason', 'Status', 'Requested', ''].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(req => {
                  const st = STATUS_STYLES[req.status] || STATUS_STYLES.Pending;
                  return (
                    <tr key={req.name} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-[var(--color-text)]">{req.student_name || req.student}</p>
                        <p className="text-xs text-gray-400">{req.student}</p>
                      </td>
                      <td className="px-5 py-4 text-sm text-[var(--color-primary)] font-medium whitespace-nowrap">{req.fees}</td>
                      <td className="px-5 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {req.concession_type === 'Percentage' ? `${req.concession_value}%` : INR(req.concession_value)}
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-[var(--color-text)] whitespace-nowrap">{INR(req.concession_amount)}</td>
                      <td className="px-5 py-4">
                        <p className="text-xs font-medium text-gray-500">{req.reason_category}</p>
                        <p className="text-xs text-gray-400 max-w-[200px] truncate">{req.reason}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${st.pill}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {req.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-400 whitespace-nowrap">
                        <p>{req.requested_by}</p>
                        <p>{fmtDate(req.creation)}</p>
                      </td>
                      <td className="px-5 py-4">
                        {req.status === 'Pending' && canApprove && (
                          <div className="flex items-center gap-2">
                            <button onClick={() => setApproveTarget(req)}
                              className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 hover:bg-emerald-100 transition">
                              Approve
                            </button>
                            <button onClick={() => setRejectTarget(req)}
                              className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-100 transition">
                              Reject
                            </button>
                          </div>
                        )}
                        {req.status === 'Approved' && (
                          <div className="text-xs text-gray-400">
                            <p>by {req.approved_by}</p>
                            <p>{fmtDate(req.approval_date)}</p>
                          </div>
                        )}
                        {req.status === 'Rejected' && req.rejection_reason && (
                          <p className="text-xs text-red-500 max-w-[150px] truncate" title={req.rejection_reason}>{req.rejection_reason}</p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Approve Dialog */}
      {approveTarget && (
        <ApproveDialog
          request={approveTarget}
          onDone={() => { setApproveTarget(null); refetch(); }}
          onCancel={() => setApproveTarget(null)}
        />
      )}

      {/* Reject Dialog */}
      {rejectTarget && (
        <RejectDialog
          request={rejectTarget}
          onDone={() => { setRejectTarget(null); refetch(); }}
          onCancel={() => setRejectTarget(null)}
        />
      )}
    </div>
  );
}

// ── Approve Dialog ──────────────────────────────────────────────────────────

function ApproveDialog({ request, onDone, onCancel }) {
  const updateMutation = useUpdateConcessionRequest();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleApprove = async () => {
    setSaving(true);
    setError('');
    try {
      // 1. Update concession request status
      await updateMutation.mutateAsync({
        name: request.name,
        data: {
          status: 'Approved',
          approved_by: window.frappe?.session?.user || 'Administrator',
          approval_date: new Date().toISOString().split('T')[0],
        },
      });

      // 2. Apply concession to the linked Fees invoice as a negative Fee Component
      const { getDoc } = await import('../../api/frappe');
      const fullFee = await getDoc('Fees', request.fees);
      const existingComponents = (fullFee.components || []).map(c => ({
        doctype: 'Fee Component',
        fees_category: c.fees_category,
        amount: c.amount,
        discount: c.discount || 0,
        total: c.total || c.amount,
        item: c.item || c.fees_category,
      }));

      // Find or create a "Concession" Fee Category
      let concessionCategory = 'Concession';
      try {
        const categories = await import('../../api/frappe').then(m => m.getList('Fee Category', [], ['name', 'category_name'], 100));
        const existing = categories.find(c => c.category_name === 'Concession' || c.name === 'Concession');
        if (existing) concessionCategory = existing.name;
      } catch { /* use default */ }

      const concessionAmount = -(request.concession_amount || 0);
      const newComponent = {
        doctype: 'Fee Component',
        fees_category: concessionCategory,
        amount: concessionAmount,
        discount: 0,
        total: concessionAmount,
        item: concessionCategory,
      };

      await import('../../api/frappe').then(m => m.updateDoc('Fees', request.fees, {
        components: [...existingComponents, newComponent],
      }));

      onDone();
    } catch (err) {
      setError(err.readableMessage || 'Failed to approve concession.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
            <span className="text-emerald-600 text-lg font-bold">✓</span>
          </div>
          <div>
            <h3 className="font-bold text-[var(--color-text)]">Approve Concession</h3>
            <p className="text-xs text-gray-400">This will apply the concession to the invoice</p>
          </div>
        </div>
        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4">{error}</div>}
        <div className="bg-gray-50 rounded-xl p-4 mb-5 text-sm space-y-1.5">
          <div className="flex justify-between"><span className="text-gray-500">Student</span><span className="font-semibold">{request.student_name}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Invoice</span><span className="font-semibold">{request.fees}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Category</span><span className="font-semibold">{request.reason_category}</span></div>
          <div className="flex justify-between border-t border-gray-200 pt-1.5 mt-1.5">
            <span className="text-gray-500">Concession Amount</span>
            <span className="font-bold text-emerald-600">{INR(request.concession_amount)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleApprove} disabled={saving}
            className="px-5 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 disabled:opacity-50">
            {saving ? 'Approving...' : 'Approve & Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reject Dialog ───────────────────────────────────────────────────────────

function RejectDialog({ request, onDone, onCancel }) {
  const updateMutation = useUpdateConcessionRequest();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleReject = async () => {
    if (!reason.trim()) { setError('Please provide a rejection reason.'); return; }
    setSaving(true);
    setError('');
    try {
      await updateMutation.mutateAsync({
        name: request.name,
        data: { status: 'Rejected', rejection_reason: reason.trim() },
      });
      onDone();
    } catch (err) {
      setError(err.readableMessage || 'Failed to reject concession.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <span className="text-red-600 text-lg font-bold">✕</span>
          </div>
          <div>
            <h3 className="font-bold text-[var(--color-text)]">Reject Concession</h3>
            <p className="text-xs text-gray-400">Provide a reason for rejection</p>
          </div>
        </div>
        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4">{error}</div>}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Rejection Reason</label>
          <textarea rows={3} placeholder="Why is this concession being rejected?"
            value={reason} onChange={e => setReason(e.target.value)}
            className="input w-full text-sm resize-none" />
        </div>
        <div className="flex items-center gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleReject} disabled={saving || !reason.trim()}
            className="px-5 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 disabled:opacity-50">
            {saving ? 'Rejecting...' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}
