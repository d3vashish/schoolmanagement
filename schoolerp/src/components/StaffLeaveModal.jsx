import { useState } from 'react';
import { useApplyStaffLeave } from '../hooks/useStaff';

const LEAVE_TYPES = [
  'Sick Leave',
  'Casual Leave',
  'Annual Leave',
  'Personal Leave',
  'Maternity Leave',
  'Other',
];

export default function StaffLeaveModal({ show, onClose, employees = [], defaultStaffId = '' }) {
  const [form, setForm] = useState({
    staff_id: defaultStaffId,
    leave_type: 'Sick Leave',
    start_date: '',
    end_date: '',
    reason: '',
  });

  const applyMutation = useApplyStaffLeave({
    onSuccess: () => {
      setForm({ staff_id: defaultStaffId, leave_type: 'Sick Leave', start_date: '', end_date: '', reason: '' });
      onClose?.();
    },
  });

  if (!show) return null;

  const isValid = form.staff_id && form.start_date && form.end_date;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-[#2D2A24]">Apply for Leave</h3>
          <button onClick={onClose} className="p-2 text-[#8A8680] hover:text-[#2D2A24] transition-colors cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Staff Member</label>
            <select value={form.staff_id} onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))}
              className="input text-sm w-full">
              <option value="">Select staff member</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.full_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Leave Type</label>
            <select value={form.leave_type} onChange={e => setForm(f => ({ ...f, leave_type: e.target.value }))}
              className="input text-sm w-full">
              {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Start Date</label>
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="input text-sm w-full" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">End Date</label>
              <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="input text-sm w-full" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Reason</label>
            <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              className="input text-sm w-full min-h-[100px]" placeholder="Please provide a reason for leave…" />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#f1f5f9]">
          <button onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
            Cancel
          </button>
          <button onClick={() => applyMutation.mutate(form)}
            disabled={!isValid || applyMutation.isPending}
            className="btn-primary px-6 py-2.5 text-sm font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {applyMutation.isPending ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Submitting…</>
            ) : 'Submit Leave'}
          </button>
        </div>

        {applyMutation.isError && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {applyMutation.error?.message || 'Failed to apply leave'}
          </div>
        )}
      </div>
    </div>
  );
}
