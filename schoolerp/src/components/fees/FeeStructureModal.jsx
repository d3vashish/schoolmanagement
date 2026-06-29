import { useState, useEffect } from 'react';
import { useAcademicYear } from '../../context/AcademicYearContext';
import {
  useClassSummary,
  useFeeHeadsList,
  useStructureInstallments,
  useCreateFeeStructureDetailed,
  useUpdateFeeStructureDetailed,
  useCreateFeeInstallment,
  useUpdateFeeInstallment,
  useDeleteFeeInstallment,
} from '../../hooks/useFees';

let _tempIdCounter = 0;
const tempId = () => `temp-${++_tempIdCounter}`;

// One installment row in the form — name, due date, percent. Existing rows
// (loaded from an existing structure) carry a real `id`; new rows carry a
// temp id until saved, so we know which create/update/delete call to make
// for each row on submit.
function InstallmentRow({ installment, onChange, onRemove }) {
  return (
    <div className="grid grid-cols-12 gap-2 items-center">
      <input
        type="text"
        value={installment.name}
        onChange={(e) => onChange({ ...installment, name: e.target.value })}
        placeholder="e.g. Term 1"
        className="col-span-5 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
      />
      <input
        type="date"
        value={installment.due_date}
        onChange={(e) => onChange({ ...installment, due_date: e.target.value })}
        className="col-span-4 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
      />
      <div className="col-span-2 relative">
        <input
          type="number"
          min="1"
          max="100"
          value={installment.percent}
          onChange={(e) => onChange({ ...installment, percent: e.target.value })}
          className="w-full px-3 py-2 pr-6 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
      </div>
      <button
        onClick={onRemove}
        className="col-span-1 text-gray-300 hover:text-red-500 transition flex justify-center"
        title="Remove installment"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function FeeStructureModal({ existingStructure, onClose, onSaved }) {
  const { selectedYear } = useAcademicYear();
  const { data: classSummary = [] } = useClassSummary(selectedYear);
  const { data: feeHeads = [] } = useFeeHeadsList();

  const isEdit = !!existingStructure;

  const { data: loadedInstallments = [], isLoading: loadingInstallments } =
    useStructureInstallments(existingStructure?.id);

  const [classId, setClassId] = useState(existingStructure?.class_id || '');
  const [feeHeadId, setFeeHeadId] = useState(existingStructure?.fee_head_id || '');
  const [isNewStudent, setIsNewStudent] = useState(existingStructure?.is_new_student || false);
  const [amount, setAmount] = useState(existingStructure?.amount?.toString() || '');
  const [installments, setInstallments] = useState(
    isEdit ? [] : [{ id: tempId(), name: '', due_date: '', percent: '100' }]
  );
  const [installmentsSeeded, setInstallmentsSeeded] = useState(!isEdit);
  const [removedInstallmentIds, setRemovedInstallmentIds] = useState([]);
  const [submitError, setSubmitError] = useState('');

  // Seed the installment rows once they've loaded for an existing structure.
  // Only runs once (installmentsSeeded guard) so it doesn't clobber edits the
  // user has already made if this component re-renders after the fetch settles.
  useEffect(() => {
    if (isEdit && !installmentsSeeded && !loadingInstallments) {
      setInstallments(
        loadedInstallments.length
          ? loadedInstallments.map(i => ({ ...i, percent: String(i.percent) }))
          : [{ id: tempId(), name: '', due_date: '', percent: '100' }]
      );
      setInstallmentsSeeded(true);
    }
  }, [isEdit, installmentsSeeded, loadingInstallments, loadedInstallments]);

  const createStructure = useCreateFeeStructureDetailed();
  const updateStructure = useUpdateFeeStructureDetailed();
  const createInstallment = useCreateFeeInstallment();
  const updateInstallment = useUpdateFeeInstallment();
  const deleteInstallment = useDeleteFeeInstallment();

  const percentTotal = installments.reduce((sum, i) => sum + (Number(i.percent) || 0), 0);
  const percentValid = percentTotal === 100;

  const addInstallment = () => {
    setInstallments(prev => [...prev, { id: tempId(), name: '', due_date: '', percent: '' }]);
  };

  const updateInstallmentRow = (idx, next) => {
    setInstallments(prev => prev.map((row, i) => (i === idx ? next : row)));
  };

  const removeInstallmentRow = (idx) => {
    const row = installments[idx];
    if (!String(row.id).startsWith('temp-')) {
      setRemovedInstallmentIds(prev => [...prev, row.id]);
    }
    setInstallments(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    setSubmitError('');

    if (!classId || !feeHeadId || !amount) {
      setSubmitError('Class, fee head, and amount are all required.');
      return;
    }
    if (installments.length === 0) {
      setSubmitError('Add at least one installment — a structure with no installments can\'t bill anyone.');
      return;
    }
    if (!percentValid) {
      setSubmitError(`Installment percentages must add up to 100% (currently ${percentTotal}%).`);
      return;
    }
    if (installments.some(i => !i.name || !i.due_date || !i.percent)) {
      setSubmitError('Every installment needs a name, due date, and percent.');
      return;
    }

    try {
      let structureId = existingStructure?.id;

      const structurePayload = {
        academic_year_id: selectedYear,
        class_id: classId,
        fee_head_id: feeHeadId,
        amount: Number(amount),
        is_new_student: isNewStudent,
      };

      if (isEdit) {
        await updateStructure.mutateAsync({ id: structureId, data: structurePayload });
      } else {
        const created = await createStructure.mutateAsync(structurePayload);
        structureId = created.id;
      }

      // Delete removed installments first.
      for (const id of removedInstallmentIds) {
        await deleteInstallment.mutateAsync(id);
      }

      // Create or update each remaining installment row.
      for (const row of installments) {
        const payload = {
          structure_id: structureId,
          name: row.name,
          due_date: row.due_date,
          percent: Number(row.percent),
        };
        if (String(row.id).startsWith('temp-')) {
          await createInstallment.mutateAsync(payload);
        } else {
          await updateInstallment.mutateAsync({ id: row.id, data: payload });
        }
      }

      onSaved?.();
    } catch (err) {
      setSubmitError(err?.readableMessage || 'Something went wrong saving this structure. Nothing further was changed — you can retry.');
    }
  };

  const saving = createStructure.isPending || updateStructure.isPending ||
    createInstallment.isPending || updateInstallment.isPending || deleteInstallment.isPending;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="font-bold text-[var(--color-text)]">{isEdit ? 'Edit Fee Structure' : 'New Fee Structure'}</h2>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-400 mb-1.5 block">Class</label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
            >
              <option value="">Select a class...</option>
              {classSummary.map(c => (
                <option key={c.class_id} value={c.class_id}>{c.class_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-400 mb-1.5 block">Fee Head</label>
            <select
              value={feeHeadId}
              onChange={(e) => setFeeHeadId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
            >
              <option value="">Select a fee head...</option>
              {feeHeads.map(h => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsNewStudent(false)}
              className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition ${
                !isNewStudent ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'border-gray-200 text-gray-500'
              }`}
            >
              Old Student
            </button>
            <button
              type="button"
              onClick={() => setIsNewStudent(true)}
              className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition ${
                isNewStudent ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'border-gray-200 text-gray-500'
              }`}
            >
              New Student
            </button>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-400 mb-1.5 block">Total Amount (₹)</label>
            <input
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 12600"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-400">Installments</label>
              <span className={`text-xs font-medium ${percentValid ? 'text-emerald-600' : 'text-red-500'}`}>
                {percentTotal}% of 100%
              </span>
            </div>
            <div className="space-y-2">
              {isEdit && !installmentsSeeded ? (
                <p className="text-xs text-gray-400 py-2">Loading installments...</p>
              ) : (
                installments.map((row, idx) => (
                  <InstallmentRow
                    key={row.id}
                    installment={row}
                    onChange={(next) => updateInstallmentRow(idx, next)}
                    onRemove={() => removeInstallmentRow(idx)}
                  />
                ))
              )}
            </div>
            <button
              type="button"
              onClick={addInstallment}
              className="mt-3 text-xs font-medium text-[var(--color-primary)] hover:underline"
            >
              + Add installment
            </button>
          </div>

          {submitError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {submitError}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 rounded-lg transition">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg hover:opacity-90 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Structure'}
          </button>
        </div>
      </div>
    </div>
  );
}