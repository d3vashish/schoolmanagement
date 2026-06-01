import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRecordPayment, useFeesWithPayments, useAllStudents, INR } from '../../hooks/useFees';
import { getList } from '../../api/frappe';
import FeeReceiptModal from './FeeReceiptModal';

export default function RecordPaymentModal({ onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [receiptPaymentName, setReceiptPaymentName] = useState('');
  const [form, setForm] = useState({
    student: '',
    fee_invoice: '',
    amount: '',
    payment_mode: 'Cash',
    reference_no: '',
    posting_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const { data: students = [] } = useAllStudents();
  const { data: unpaidFees = [] } = useFeesWithPayments(
    form.student ? [['student', '=', form.student]] : [],
    { enabled: !!form.student }
  );
  const { data: modes = [] } = useQuery({
    queryKey: ['Mode of Payment', 'list'],
    queryFn: () => getList('Mode of Payment', [], ['name'], 50),
    placeholderData: [{ name: 'Cash' }, { name: 'UPI' }, { name: 'Bank Transfer' }, { name: 'Cheque' }],
  });

  const mutation = useRecordPayment();

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Auto-fill amount when fee invoice changes
  const handleInvoiceChange = (invoiceName) => {
    setField('fee_invoice', invoiceName);
    const fee = unpaidFees.find(f => f.name === invoiceName);
    if (fee) {
      setField('amount', fee.effective_outstanding || '');
    }
  };

  // Get selected student's customer name
  const selectedStudent = students.find(s => s.name === form.student);
  const customerName = selectedStudent?.customer || '';

  const canSave = form.student && form.fee_invoice && form.amount && parseFloat(form.amount) > 0 && customerName;

  const handleSave = async () => {
    if (!form.student || !form.fee_invoice || !form.amount) {
      setError('Please fill all required fields.');
      return;
    }
    if (!customerName) {
      setError('Selected student has no linked Customer account. Please create a Customer in ERPNext first.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const amount = parseFloat(form.amount);
      const paymentData = {
        doctype: 'Payment Entry',
        payment_type: 'Receive',
        party_type: 'Customer',
        party: customerName || form.student,
        paid_from: 'Debtors - S',
        paid_to: 'Cash - S',
        paid_amount: amount,
        received_amount: amount,
        source_exchange_rate: 1,
        target_exchange_rate: 1,
        posting_date: form.posting_date,
        mode_of_payment: form.payment_mode,
        reference_no: form.reference_no || undefined,
        remarks: form.notes || undefined,
        fee_invoice: form.fee_invoice,
        fee_amount: amount,
      };

      const result = await mutation.mutateAsync(paymentData);
      // Show receipt — queries already invalidated by useRecordPayment onSuccess
      setReceiptPaymentName(result?.name || '');
    } catch (err) {
      setError(err.readableMessage || err.response?.data?.message || 'Failed to record payment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text)]">Record Payment</h2>
            <p className="text-xs text-gray-400 mt-0.5">Record a fee payment from a student</p>
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

          {/* Student */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Student <span className="text-red-500">*</span>
            </label>
            <select value={form.student}
              onChange={e => { setField('student', e.target.value); setField('fee_invoice', ''); setField('amount', ''); }}
              className="input w-full text-sm">
              <option value="">Select Student</option>
              {students.map(s => (
                <option key={s.name} value={s.name}>{s.student_name} ({s.name})</option>
              ))}
            </select>
          </div>

          {/* Fee Invoice */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Fee Invoice <span className="text-red-500">*</span>
            </label>
            {!form.student ? (
              <p className="text-sm text-gray-400 italic">Select a student first</p>
            ) : unpaidFees.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No unpaid invoices for this student</p>
            ) : (
              <select value={form.fee_invoice}
                onChange={e => handleInvoiceChange(e.target.value)}
                className="input w-full text-sm">
                <option value="">Select Invoice</option>
                {unpaidFees.map(f => (
                  <option key={f.name} value={f.name}>
                    {f.name} — Outstanding: {INR(f.effective_outstanding)} (Total: {INR(f.grand_total)})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Amount */}
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
            {form.fee_invoice && (
              <p className="text-xs text-gray-400 mt-1">
                Outstanding: {INR(unpaidFees.find(f => f.name === form.fee_invoice)?.effective_outstanding || 0)}
              </p>
            )}
          </div>

          {/* Payment Mode */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Payment Mode</label>
            <div className="flex flex-wrap gap-2">
              {(modes.length ? modes : [{ name: 'Cash' }, { name: 'UPI' }, { name: 'Bank Transfer' }, { name: 'Cheque' }]).map(m => (
                <button key={m.name} type="button"
                  onClick={() => setField('payment_mode', m.name)}
                  className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
                    form.payment_mode === m.name
                      ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}>
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          {/* Reference No (for non-cash) */}
          {form.payment_mode !== 'Cash' && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Reference Number</label>
              <input type="text" placeholder="e.g. UPI Transaction ID, Cheque No."
                value={form.reference_no}
                onChange={e => setField('reference_no', e.target.value)}
                className="input w-full text-sm" />
            </div>
          )}

          {/* Posting Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Payment Date</label>
            <input type="date" value={form.posting_date}
              onChange={e => setField('posting_date', e.target.value)}
              className="input w-full text-sm" />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Notes</label>
            <textarea placeholder="Optional notes..." value={form.notes}
              onChange={e => setField('notes', e.target.value)}
              className="input w-full text-sm resize-none" rows={2} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <button onClick={onClose}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !canSave}
            className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50 flex items-center gap-2 group">
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</>
            ) : 'Record Payment'}
          </button>
        </div>
      </div>
      {/* Fee Receipt Modal */}
      {receiptPaymentName && (
        <FeeReceiptModal
          paymentName={receiptPaymentName}
          feeInvoiceName={form.fee_invoice}
          onClose={() => { setReceiptPaymentName(''); onSaved(); }}
        />
      )}
    </div>
  );
}
