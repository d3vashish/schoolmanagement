import { useState } from 'react';
import { useAcademicYear } from '../../context/AcademicYearContext';
import { useFeeStructures, INR } from '../../hooks/useFees';
import StructureModal from './StructureModal';

export default function FeeStructures() {
  const { selectedYear } = useAcademicYear();
  const [showModal, setShowModal] = useState(false);
  const [editName, setEditName] = useState(null);

  const [dismissed, setDismissed] = useState(false);

  const yearFilter = selectedYear ? [['academic_year', '=', selectedYear]] : [];
  const { data: structures = [], isLoading, error, refetch } = useFeeStructures(yearFilter);

  const handleEdit = (name) => {
    setEditName(name);
    setShowModal(true);
  };

  const handleNew = () => {
    setEditName(null);
    setShowModal(true);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Define fee templates per program and academic year. Use them to batch-generate student invoices.
          </p>
        </div>
        <button onClick={handleNew} className="btn-primary flex items-center gap-2 text-sm px-4 py-2.5 group">
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center transition-all duration-300 group-hover:bg-white/30 group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </span>
          New Structure
        </button>
      </div>

      {/* Error Banner */}
      {error && !dismissed && (
        <div className="flex items-center justify-between gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm">
          <div className="flex items-center gap-2">
            <span className="text-red-500 font-bold">!</span>
            <span className="text-red-700">{error?.readableMessage || 'Failed to load fee structures'}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => refetch()}
              className="px-3 py-1 text-xs font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition">
              Retry
            </button>
            <button onClick={() => setDismissed(true)}
              className="text-red-400 hover:text-red-600 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-28 gap-3">
          <div className="w-10 h-10 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--color-text-secondary)]">Loading fee structures...</p>
        </div>
      ) : structures.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center text-4xl mb-4 border border-indigo-100">📋</div>
          <p className="font-bold text-[var(--color-text)] text-lg">No fee structures yet</p>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1 max-w-xs">
            Create a fee structure to define the fee components for a program. Then use it to batch-generate invoices.
          </p>
          <button onClick={handleNew} className="mt-5 btn-primary text-sm px-5 py-2.5 flex items-center gap-2 group">
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </span>
            Create First Structure
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {structures.map(s => (
            <StructureCard key={s.name} structure={s} onEdit={() => handleEdit(s.name)} />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <StructureModal
          editName={editName}
          onClose={() => { setShowModal(false); setEditName(null); }}
          onSaved={() => { setShowModal(false); setEditName(null); }}
        />
      )}
    </div>
  );
}

function StructureCard({ structure, onEdit }) {
  const isDraft = structure.docstatus === 0;
  const isSubmitted = structure.docstatus === 1;

  return (
    <div className="p-5 rounded-2xl border bg-white hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer group"
      onClick={onEdit}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs text-gray-400 font-mono">{structure.name}</p>
          <p className="font-bold text-[var(--color-text)] mt-0.5">{structure.program}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
          isSubmitted
            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
            : 'bg-gray-100 text-gray-600 border-gray-200'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isSubmitted ? 'bg-emerald-400' : 'bg-gray-400'}`} />
          {isSubmitted ? 'Active' : 'Draft'}
        </span>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Academic Year</span>
          <span className="font-medium text-[var(--color-text)]">{structure.academic_year}</span>
        </div>
        {structure.student_category && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Category</span>
            <span className="font-medium text-[var(--color-text)]">{structure.student_category}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Frequency</span>
          <span className="font-medium text-[var(--color-text)]">{structure.collection_frequency || '—'}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <span className="text-xs text-gray-400">Total Amount</span>
        <span className="text-lg font-bold text-[var(--color-primary)]">{INR(structure.total_amount)}</span>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        Click to edit
      </div>
    </div>
  );
}
