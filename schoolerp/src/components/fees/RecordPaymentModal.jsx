import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRecordPayment, INR } from '../../hooks/useFees';
import { client } from '../../api/frappe';

const PAYMENT_MODES = ['CASH', 'CHEQUE', 'BANK_TRANSFER', 'ONLINE'];

export default function RecordPaymentModal({ studentId, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    invoice_id: '',
    amount: '',
    mode: 'CASH',
    reference_no: '',
    notes: '',
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['Fees', 'invoices', studentId],
    queryFn: async () => {
      const res = await client.get('/fees/invoices', { params: { student_id: studentId } });
      return res.data;
    },
    enabled: !!studentId,
  });

  const mutation = useRecordPayment();
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const unpaidInvoices = invoices.filter(inv => inv.status !== 'PAID');

  const handleInvoiceChange = (invoiceId) => {
    setField('invoice_id', invoiceId);
    const inv = unpaidInvoices.find(i => i.id === invoiceId);
    if (inv) {
      const outstanding = (inv.net_amount || 0) - (inv.paid_amount || 0);
      setField('amount', outstanding.toString());
    }
  };

  const canSave = form.invoice_id && form.amount && parseFloat(form.amount) > 0;

  const handleSave = async () => {
    if (!form.invoice_id || !form.amount || parseFloat(form.amount) <= 0) {
      setError('Please select an invoice and enter a valid amount.');
      return;
    }
    setSaving(true);
    setError('');

    try {
      await mutation.mutateAsync({
        invoice_id: form.invoice_id,
        amount: parseFloat(form.amount),
        mode: form.mode.toUpperCase(),
        reference_no: form.reference_no || undefined,
        notes: form.notes || undefined,
      });
      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.detail || err.readableMessage || 'Failed to record payment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text)]">Record Payment</h2>
            <p className="text-xs text-gray-400 mt-0.5">Record a payment for this student</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 group">
            <span className="w-5 h-5 rounded-full bg-black/5 flex items-center justify-center group-hover:bg-black/10 transition-all duration-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100">{error}</div>}

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Invoice <span className="text-red-500">*</span>
            </label>
            {unpaidInvoices.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No unpaid invoices</p>
            ) : (
              <select value={form.invoice_id}
                onChange={e => handleInvoiceChange(e.target.value)}
                className="input w-full text-sm">
                <option value="">Select Invoice</option>
                {unpaidInvoices.map(inv => {
                  const outstanding = (inv.net_amount || 0) - (inv.paid_amount || 0);
                  return (
                    <option key={inv.id} value={inv.id}>
                      Due: {INR(outstanding)} — {inv.status}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Amount <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">Rs</span>
              <input type="number" placeholder="0" value={form.amount}
                onChange={e => setField('amount', e.target.value)}
                className="input w-full text-sm pl-9" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Payment Mode</label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_MODES.map(m => (
                <button key={m} type="button"
                  onClick={() => setField('mode', m)}
                  className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
                    form.mode === m
                      ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {form.mode !== 'CASH' && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Reference Number</label>
              <input type="text" placeholder="UPI ID, Cheque No, Transaction ID"
                value={form.reference_no}
                onChange={e => setField('reference_no', e.target.value)}
                className="input w-full text-sm" />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Notes</label>
            <textarea placeholder="Optional notes..." value={form.notes}
              onChange={e => setField('notes', e.target.value)}
              className="input w-full text-sm resize-none" rows={2} />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <button onClick={onClose}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !canSave}
            className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50 flex items-center gap-2">
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</>
            ) : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
