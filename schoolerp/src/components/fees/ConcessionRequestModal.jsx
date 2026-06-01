import { useState, useMemo } from 'react';
import { useCreateConcessionRequest, useAllStudents, useFeesWithPayments, calcConcessionAmount, INR } from '../../hooks/useFees';
import { useAcademicYear } from '../../context/AcademicYearContext';
import { useAuth } from '../../context/AuthContext';

const CONCESSION_TYPES = ['Fixed Amount', 'Percentage'];
const REASON_CATEGORIES = ['Scholarship', 'Financial Hardship', 'Staff Ward', 'Sibling Discount', 'Merit', 'Other'];

export default function ConcessionRequestModal({ studentId, feesName, onClose, onCreated }) {
  const { selectedYear } = useAcademicYear();
  const { data: students = [] } = useAllStudents();
  const yearFilter = selectedYear ? [['academic_year', '=', selectedYear]] : [];
  const { data: fees = [] } = useFees(yearFilter);
  const { user } = useAuth();
  const createMutation = useCreateConcessionRequest();

  const [form, setForm] = useState({
    student: studentId || '',
    fees: feesName || '',
    concession_type: 'Fixed Amount',
    concession_value: '',
    reason_category: '',
    reason: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const selectedFee = fees.find(f => f.name === form.fees);
  const invoiceTotal = selectedFee?.effective_outstanding || selectedFee?.grand_total || 0;
  const previewAmount = useMemo(
    () => calcConcessionAmount(form.concession_type, parseFloat(form.concession_value) || 0, invoiceTotal),
    [form.concession_type, form.concession_value, invoiceTotal]
  );

  const canSubmit = form.student && form.fees && form.concession_value && form.reason_category && form.reason;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    try {
      await createMutation.mutateAsync({
        student: form.student,
        fees: form.fees,
        concession_type: form.concession_type,
        concession_value: parseFloat(form.concession_value) || 0,
        concession_amount: previewAmount,
        reason_category: form.reason_category,
        reason: form.reason,
        requested_by: user?.name || user?.email || 'Administrator',
        status: 'Pending',
      });
      onCreated?.();
    } catch (err) {
      setError(err.readableMessage || 'Failed to submit concession request.');
    } finally {
      setSaving(false);
    }
  };

  const studentOptions = students.map(s => ({ value: s.name, label: s.student_name || s.name }));
  const feeOptions = fees
    .filter(f => !form.student || f.student === form.student)
    .filter(f => (f.effective_outstanding || 0) > 0)
    .map(f => ({ value: f.name, label: `${f.name} — ${f.student_name} — ${INR(f.effective_outstanding)} outstanding` }));

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg text-[var(--color-text)]">Request Fee Concession</h2>
            <p className="text-xs text-gray-400 mt-0.5">Submit for approval — will not be auto-applied</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Student</label>
            <select value={form.student} onChange={e => { setField('student', e.target.value); setField('fees', ''); }}
              className="input w-full text-sm" disabled={!!studentId}>
              <option value="">Select student</option>
              {studentOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Fee Invoice</label>
            <select value={form.fees} onChange={e => setField('fees', e.target.value)}
              className="input w-full text-sm" disabled={!!feesName}>
              <option value="">Select invoice</option>
              {feeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Concession Type</label>
              <select value={form.concession_type} onChange={e => setField('concession_type', e.target.value)}
                className="input w-full text-sm">
                {CONCESSION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                {form.concession_type === 'Percentage' ? 'Percent (%)' : 'Amount'}
              </label>
              <input type="number" min="0" step={form.concession_type === 'Percentage' ? '0.5' : '1'}
                placeholder={form.concession_type === 'Percentage' ? 'e.g. 10' : 'e.g. 2000'}
                value={form.concession_value} onChange={e => setField('concession_value', e.target.value)}
                className="input w-full text-sm" />
            </div>
          </div>

          {previewAmount > 0 && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm">
              <span className="text-emerald-700">Concession amount: </span>
              <span className="font-bold text-emerald-800">{INR(previewAmount)}</span>
              {invoiceTotal > 0 && (
                <span className="text-emerald-600 ml-1">
                  ({Math.round(previewAmount / invoiceTotal * 100)}% of {INR(invoiceTotal)} outstanding)
                </span>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Reason Category</label>
            <select value={form.reason_category} onChange={e => setField('reason_category', e.target.value)}
              className="input w-full text-sm">
              <option value="">Select category</option>
              {REASON_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Reason</label>
            <textarea rows={3} placeholder="Explain why this concession is being requested..."
              value={form.reason} onChange={e => setField('reason', e.target.value)}
              className="input w-full text-sm resize-none" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={!canSubmit || saving}
            className="px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
}
