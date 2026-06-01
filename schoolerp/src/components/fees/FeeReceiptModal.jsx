import { useEffect, useState } from 'react';
import { getDoc } from '../../api/frappe';
import { INR, fmtDate } from '../../hooks/useFees';
import { useSettings } from '../../context/SettingsContext';

export default function FeeReceiptModal({ paymentName, feeInvoiceName, onClose }) {
  const settings = useSettings();
  const SCHOOL_NAME = settings.school_name || 'Syncocept International School';
  const SCHOOL_ADDRESS = settings.school_address || '';
  const SCHOOL_PHONE = settings.school_phone || '';
  const [payment, setPayment] = useState(null);
  const [fee, setFee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!paymentName) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const payDoc = await getDoc('Payment Entry', paymentName);
        if (cancelled) return;
        setPayment(payDoc);

        // Fetch linked fee invoice for student details + outstanding
        // Try feeInvoiceName prop first (since Payment Entry no longer has references)
        const refName = feeInvoiceName || (payDoc.references || []).find(
          r => r.reference_doctype === 'Fees'
        )?.reference_name;
        if (refName) {
          const feeDoc = await getDoc('Fees', refName);
          if (!cancelled) setFee(feeDoc);
        }
      } catch (err) {
        if (!cancelled) setError(err.readableMessage || 'Failed to load receipt data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [paymentName, feeInvoiceName]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 print:bg-transparent print:inset-auto print:p-0">
        <div className="bg-white rounded-2xl shadow-2xl p-10 text-center print:shadow-none print:rounded-none">
          <div className="w-10 h-10 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400 mt-3">Generating receipt...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 print:bg-transparent print:inset-auto print:p-0">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center print:shadow-none print:rounded-none">
          <div className="text-4xl mb-3">!</div>
          <p className="font-bold text-lg text-red-600">Receipt Error</p>
          <p className="text-sm text-gray-500 mt-2">{error}</p>
          <button onClick={onClose} className="mt-5 px-5 py-2.5 border rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 print:hidden">
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!payment) return null;

  const feeRef = (payment.references || []).find(r => r.reference_doctype === 'Fees');
  // Compute effective outstanding: fee total minus this payment amount
  const outstanding = fee ? Math.max(0, (fee.grand_total || 0) - (payment.paid_amount || 0)) : null;
  const studentName = fee?.student_name || payment.party_name || payment.party;
  const program = fee?.program || '—';
  const academicYear = fee?.academic_year || '—';
  const feeInvoice = feeInvoiceName || feeRef?.reference_name || fee?.name || '—';

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 print:inset-auto print:p-0 print:bg-transparent">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden print:shadow-none print:rounded-none print:max-w-none print:w-auto print:overflow-visible">
        {/* Receipt Content — this is what prints */}
        <div className="fee-receipt p-8 print:p-6">
          {/* Header */}
          <div className="text-center border-b-2 border-gray-800 pb-4 mb-5">
            <h1 className="text-xl font-bold tracking-wide text-gray-900 print:text-black">{SCHOOL_NAME}</h1>
            {SCHOOL_ADDRESS && (
              <p className="text-xs text-gray-500 mt-1 print:text-gray-700">{SCHOOL_ADDRESS}</p>
            )}
            {SCHOOL_PHONE && (
              <p className="text-xs text-gray-500 print:text-gray-700">Ph: {SCHOOL_PHONE}</p>
            )}
            <h2 className="text-sm font-semibold uppercase tracking-widest mt-3 text-gray-700 print:text-black">
              Fee Payment Receipt
            </h2>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm mb-5">
            <DetailRow label="Receipt No" value={payment.name} />
            <DetailRow label="Date" value={fmtDate(payment.posting_date)} />
            <DetailRow label="Student Name" value={studentName} />
            <DetailRow label="Class / Program" value={program} />
            <DetailRow label="Academic Year" value={academicYear} />
            <DetailRow label="Fee Invoice" value={feeInvoice} />
            <DetailRow label="Payment Mode" value={payment.mode_of_payment || '—'} />
            {payment.mode_of_payment && payment.mode_of_payment !== 'Cash' && payment.reference_no && (
              <DetailRow label="Reference No" value={payment.reference_no} />
            )}
          </div>

          {/* Fee Breakdown Table */}
          {fee?.components && fee.components.length > 0 && (
            <div className="mb-5">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="py-2 text-left font-semibold text-gray-600 print:text-black">Particulars</th>
                    <th className="py-2 text-right font-semibold text-gray-600 print:text-black w-28">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {fee.components.map((c, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-1.5 text-gray-700 print:text-black">
                        {c.fees_category || c.item || 'Fee Component'}
                        {c.discount > 0 && (
                          <span className="text-xs text-gray-400 ml-1">(discount: {INR(c.discount)})</span>
                        )}
                      </td>
                      <td className="py-1.5 text-right text-gray-900 print:text-black font-medium">{INR(c.total || c.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-300">
                    <td className="py-2 font-bold text-gray-900 print:text-black">Grand Total</td>
                    <td className="py-2 text-right font-bold text-gray-900 print:text-black">{INR(fee.grand_total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Payment Summary */}
          <div className="border-2 border-gray-800 rounded-lg p-4 mb-5 print:rounded-none">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-600 print:text-black">Total Fee Amount</span>
              <span className="font-medium text-gray-900 print:text-black">{INR(fee?.grand_total || payment.paid_amount)}</span>
            </div>
            {fee && (
              <>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600 print:text-black">Previously Paid</span>
                  <span className="font-medium text-gray-900 print:text-black">
                    {INR(Math.max(0, (fee.grand_total || 0) - (outstanding || 0) - payment.paid_amount))}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mb-1 text-emerald-700 print:text-black">
                  <span className="font-medium">This Payment</span>
                  <span className="font-bold">{INR(payment.paid_amount)}</span>
                </div>
                <div className="border-t border-gray-300 my-2" />
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-gray-900 print:text-black">Balance Outstanding</span>
                  <span className={`font-bold text-lg ${outstanding > 0 ? 'text-red-600 print:text-black' : 'text-emerald-700 print:text-black'}`}>
                    {INR(outstanding ?? 0)}
                  </span>
                </div>
              </>
            )}
            {!fee && (
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-gray-900 print:text-black">Amount Paid</span>
                <span className="font-bold text-lg text-emerald-700 print:text-black">{INR(payment.paid_amount)}</span>
              </div>
            )}
          </div>

          {/* Remarks */}
          {payment.remarks && (
            <p className="text-xs text-gray-500 mb-5 print:text-gray-700">
              <span className="font-semibold">Remarks:</span> {payment.remarks}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-end justify-between pt-6 border-t border-gray-200 print:border-gray-400">
            <div className="text-xs text-gray-400 print:text-gray-600">
              <p>This is a computer-generated receipt.</p>
              <p>No signature required.</p>
            </div>
            <div className="text-right">
              <div className="w-32 border-b border-gray-300 mb-1 print:border-gray-500">&nbsp;</div>
              <p className="text-xs text-gray-500 print:text-gray-700">Authorized Signatory</p>
            </div>
          </div>
        </div>

        {/* Action Buttons — hidden during print */}
        <div className="px-8 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50 print:hidden">
          <button onClick={onClose}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-white transition">
            Close
          </button>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition group">
              <svg className="w-4 h-4 transition-transform duration-200 group-hover:-translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print / Download PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 print:text-gray-600">{label}</span>
      <span className="text-sm font-medium text-gray-900 print:text-black mt-0.5">{value}</span>
    </div>
  );
}
