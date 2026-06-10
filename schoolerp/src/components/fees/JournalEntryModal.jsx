import { useState } from 'react';
import { useCreateJournalEntry } from '../../hooks/useFees';

export default function JournalEntryModal({ studentId, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    description: '',
    debit_amount: '0',
    credit_amount: '0',
  });

  const mutation = useCreateJournalEntry();
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const debit = parseFloat(form.debit_amount) || 0;
  const credit = parseFloat(form.credit_amount) || 0;
  const valid = form.description.trim() && (debit > 0 || credit > 0);

  const handleSave = async () => {
    if (!valid) {
      setError('Please enter a description and at least one amount.');
      return;
    }
    setSaving(true);
    setError('');

    try {
      await mutation.mutateAsync({
        student_id: studentId,
        description: form.description.trim(),
        debit_amount: debit,
        credit_amount: credit,
      });
      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.detail || err.readableMessage || 'Failed to create journal entry.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text)]">Journal Adjustment</h2>
            <p className="text-xs text-gray-400 mt-0.5">Create a manual debit/credit adjustment</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 group">
            <span className="w-5 h-5 rounded-full bg-black/5 flex items-center justify-center group-hover:bg-black/10 transition-all duration-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100">{error}</div>}

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea placeholder="Reason for adjustment..."
              value={form.description}
              onChange={e => setField('description', e.target.value)}
              className="input w-full text-sm resize-none" rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Debit Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">Rs</span>
                <input type="number" placeholder="0" value={form.debit_amount}
                  onChange={e => setField('debit_amount', e.target.value)}
                  className="input w-full text-sm pl-9" />
              </div>
              {debit > 0 && <p className="text-xs text-red-500 mt-1">Increases balance due</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Credit Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">Rs</span>
                <input type="number" placeholder="0" value={form.credit_amount}
                  onChange={e => setField('credit_amount', e.target.value)}
                  className="input w-full text-sm pl-9" />
              </div>
              {credit > 0 && <p className="text-xs text-emerald-500 mt-1">Decreases balance due</p>}
            </div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs font-medium text-amber-700">
              Journal adjustments require principal approval before they affect the ledger.
              The status will be set to PENDING upon creation.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <button onClick={onClose}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !valid}
            className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50 flex items-center gap-2">
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Creating...</>
            ) : 'Create Adjustment'}
          </button>
        </div>
      </div>
    </div>
  );
}
