// components/fees/RecordPaymentModal.jsx
import { useState } from 'react';
import { useAcademicYear } from '../../context/AcademicYearContext';
import {
  useStudentSearch,
  useRecordPayment,
  usePaymentModes,
  useStudentFeeSummary,
  INR,
} from '../../hooks/useFees';
import { downloadReceiptPdf } from '../../lib/receiptPdf';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// ── Step 1: pick a student ──────────────────────────────────────────────────
function StudentPicker({ onSelect }) {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: results = [], isLoading } = useStudentSearch(searchTerm);

  return (
    <div>
      <label className="text-xs font-medium text-gray-400 mb-2 block">Search a student</label>
      <div className="relative">
        <svg className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
        </svg>
        <input
          autoFocus
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Type a student's name..."
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
        />
      </div>

      {searchTerm.trim().length > 0 && (
        <div className="mt-2 border border-gray-100 rounded-xl max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="px-4 py-5 text-center text-sm text-gray-400">Searching...</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-5 text-center text-sm text-gray-400">No students found for "{searchTerm}"</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {results.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onSelect(s)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] font-bold text-sm shrink-0">
                      {(s.student_name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text)]">{s.student_name}</p>
                      <p className="text-xs text-gray-400">{s.student_group_name} • {s.section_name}</p>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Step 2: payment form for the selected student ──────────────────────────
function PaymentForm({ student, academicYear, onBack, onRecorded }) {
  const { data: summary } = useStudentFeeSummary(student.id);
  const { data: modes = [] } = usePaymentModes();
  const recordPayment = useRecordPayment();

  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('Cash');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  const balance = num(summary?.balance);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setFormError('Enter an amount greater than zero.');
      return;
    }

    try {
      const receipt = await recordPayment.mutateAsync({
        student_id: student.id,
        academic_year_id: academicYear,
        amount: amt,
        mode,
        reference_no: referenceNo || null,
        notes: notes || null,
      });
      onRecorded(receipt);
    } catch (err) {
      setFormError(err?.readableMessage || err?.message || 'Failed to record payment.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
        <button type="button" onClick={onBack} className="text-gray-300 hover:text-gray-500 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="w-9 h-9 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] font-bold shrink-0">
          {(student.student_name || '?')[0].toUpperCase()}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm text-[var(--color-text)]">{student.student_name}</p>
          <p className="text-xs text-gray-400">{student.student_group_name} • {student.section_name}</p>
        </div>
        {summary && (
          <div className="text-right">
            <p className="text-xs text-gray-400">Balance</p>
            <p className={`text-sm font-bold ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {INR(balance)}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-400 mb-1 block">Amount *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-400 mb-1 block">Payment Mode *</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
          >
            {(modes.length ? modes : [{ mode_of_payment: 'Cash' }]).map((m) => (
              <option key={m.mode_of_payment} value={m.mode_of_payment}>{m.name || m.mode_of_payment}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-400 mb-1 block">Reference No. (optional)</label>
        <input
          type="text"
          value={referenceNo}
          onChange={(e) => setReferenceNo(e.target.value)}
          placeholder="Cheque / transaction ID"
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-gray-400 mb-1 block">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] resize-none"
        />
      </div>

      {formError && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {formError}
        </div>
      )}

      <button
        type="submit"
        disabled={recordPayment.isPending}
        className="w-full py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
      >
        {recordPayment.isPending ? 'Recording...' : 'Record Payment'}
      </button>
    </form>
  );
}

// ── Step 3: success + download PDF ──────────────────────────────────────────
function SuccessView({ receipt, student, academicYearLabel, onNewPayment, onClose }) {
  const handleDownload = () => {
    downloadReceiptPdf({
      receipt_number: receipt.receipt_number,
      student_name: student.student_name,
      class_section: `${student.student_group_name || ''}${student.section_name ? ' - ' + student.section_name : ''}`,
      academic_year: academicYearLabel,
      amount: receipt.amount,
      mode: receipt.mode,
      reference_no: receipt.reference_no,
      notes: receipt.notes,
      created_at: receipt.created_at,
    });
  };

  return (
    <div className="text-center py-4 space-y-4">
      <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
        <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div>
        <p className="font-semibold text-[var(--color-text)]">Payment Recorded</p>
        <p className="text-sm text-gray-400 mt-1">
          {INR(receipt.amount)} from {student.student_name}
        </p>
        <p className="text-xs text-gray-400 mt-1 font-mono">{receipt.receipt_number}</p>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={handleDownload}
          className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m-9 7h12a2 2 0 002-2V8a2 2 0 00-2-2h-4l-2-2H5a2 2 0 00-2 2v11a2 2 0 002 2z" />
          </svg>
          Download PDF
        </button>
        <button
          onClick={onNewPayment}
          className="flex-1 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition"
        >
          Record Another
        </button>
      </div>
      <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 transition">
        Close
      </button>
    </div>
  );
}

// ── Main modal ──────────────────────────────────────────────────────────────
export default function RecordPaymentModal({ onClose }) {
  const { selectedYear } = useAcademicYear();
  const [student, setStudent] = useState(null);
  const [completedReceipt, setCompletedReceipt] = useState(null);

  const handleRecorded = (receipt) => setCompletedReceipt(receipt);

  const handleNewPayment = () => {
    setCompletedReceipt(null);
    setStudent(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 relative">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[var(--color-text)]">Record Payment</h2>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {completedReceipt ? (
          <SuccessView
            receipt={completedReceipt}
            student={student}
            academicYearLabel={selectedYear}
            onNewPayment={handleNewPayment}
            onClose={onClose}
          />
        ) : !student ? (
          <StudentPicker onSelect={setStudent} />
        ) : (
          <PaymentForm
            student={student}
            academicYear={selectedYear}
            onBack={() => setStudent(null)}
            onRecorded={handleRecorded}
          />
        )}
      </div>
    </div>
  );
}