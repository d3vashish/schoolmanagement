import { useState } from 'react';
import { useAcademicYear } from '../../context/AcademicYearContext';
import { useFeeStructuresDetailed, useDeleteFeeStructure, INR } from '../../hooks/useFees';
import FeeStructureModal from './FeeStructureModal';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// One fee structure row's pricing — shown twice per class card, once for
// old students, once for new (FeeStructure rows are split by is_new_student;
// see generate_invoices in service.py, which picks one or the other per student).
function PricingRow({ label, structure, accentClass, onEdit, onDelete }) {
  if (!structure) {
    return (
      <div className="flex items-center justify-between py-2">
        <span className="text-xs text-gray-400">{label}</span>
        <span className="text-xs text-gray-300">Not set</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between py-2 group">
      <div>
        <span className="text-xs text-gray-400">{label}</span>
        <p className="text-xs text-gray-300 mt-0.5">
          {structure.fee_head_name || 'Fee'} • {structure.installment_count ?? 0} installment
          {structure.installment_count === 1 ? '' : 's'}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-base font-bold ${accentClass}`}>{INR(num(structure.amount))}</span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(structure)} title="Edit" className="p-1 text-gray-300 hover:text-[var(--color-primary)] transition">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button onClick={() => onDelete(structure)} title="Delete" className="p-1 text-gray-300 hover:text-red-500 transition">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// One class card — groups the old-student and new-student FeeStructure rows
// for that class together, since they're separate rows in the DB but a single
// concept ("this class's fees") to anyone looking at the screen.
function ClassStructureCard({ className, oldStructure, newStructure, onEdit, onDelete }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-[var(--color-text)]">{className}</h3>
      </div>
      <div className="divide-y divide-gray-50">
        <PricingRow label="Old Student" structure={oldStructure} accentClass="text-[var(--color-text)]" onEdit={onEdit} onDelete={onDelete} />
        <PricingRow label="New Student" structure={newStructure} accentClass="text-[var(--color-primary)]" onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
  );
}

export default function FeeStructures() {
  const { selectedYear } = useAcademicYear();
  const { data: structures = [], isLoading, error, refetch } =
    useFeeStructuresDetailed({ academicYearId: selectedYear });
  const deleteStructure = useDeleteFeeStructure();

  const [modalState, setModalState] = useState(null); // null | { structure: null | obj }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  const handleDelete = async () => {
    setDeleteError('');
    try {
      await deleteStructure.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(
        err?.readableMessage ||
        'Could not delete this structure. If invoices have already been generated against it, deleting may not be allowed.'
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 gap-3">
        <div className="w-10 h-10 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[var(--color-text-secondary)]">Loading fee structures...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-between gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm">
        <div className="flex items-center gap-2">
          <span className="text-red-500 font-bold">!</span>
          <span className="text-red-700">{error?.readableMessage || 'Failed to load fee structures'}</span>
        </div>
        <button onClick={() => refetch()}
          className="px-3 py-1 text-xs font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition">
          Retry
        </button>
      </div>
    );
  }

  // Group by class_id, splitting each class's rows into old/new student structures.
  const byClass = new Map();
  for (const s of structures) {
    if (!byClass.has(s.class_id)) {
      byClass.set(s.class_id, { className: s.class_name || s.class_id, old: null, new: null });
    }
    const entry = byClass.get(s.class_id);
    if (s.is_new_student) entry.new = s;
    else entry.old = s;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Fee structures by class for the selected academic year, split by old vs. new student pricing.
        </p>
        <button
          onClick={() => setModalState({ structure: null })}
          className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg hover:opacity-90 transition shrink-0 ml-4"
        >
          + New Structure
        </button>
      </div>

      {structures.length === 0 ? (
        <div className="card text-center py-10 text-sm text-gray-400">
          No fee structures defined for this academic year yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from(byClass.values()).map(entry => (
            <ClassStructureCard
              key={entry.className}
              className={entry.className}
              oldStructure={entry.old}
              newStructure={entry.new}
              onEdit={(structure) => setModalState({ structure })}
              onDelete={(structure) => setDeleteTarget(structure)}
            />
          ))}
        </div>
      )}

      {modalState && (
        <FeeStructureModal
          existingStructure={modalState.structure}
          onClose={() => setModalState(null)}
          onSaved={() => { setModalState(null); refetch(); }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-[var(--color-text)] mb-2">Delete fee structure?</h3>
            <p className="text-sm text-gray-500 mb-4">
              This removes the {deleteTarget.fee_head_name || 'fee'} structure and its installments for{' '}
              {deleteTarget.is_new_student ? 'new' : 'old'} students. This can't be undone, and may fail if
              invoices have already been generated against it.
            </p>
            {deleteError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 mb-4">
                {deleteError}
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 rounded-lg transition">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteStructure.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:opacity-90 transition disabled:opacity-50"
              >
                {deleteStructure.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}