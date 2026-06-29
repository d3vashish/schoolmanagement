import { useState } from 'react';
import { useAcademicYear } from '../../context/AcademicYearContext';
import {
  useClassSummary,
  useStudentsBySection,
  useStudentSearch,
  useStudentFeeSummary,
  useReceipts,
  INR,
} from '../../hooks/useFees';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Fee summary card — identical shape to the one on the Dashboard tab, so a
// student looks the same no matter which tab you found them from.
function ReceiptRow({ receipt }) {
  const dt = receipt.created_at ? new Date(receipt.created_at) : null;
  return (
    <div className="px-5 py-3 flex items-center justify-between border-b border-gray-50 last:border-b-0">
      <div>
        <p className="text-sm font-medium text-[var(--color-text)]">{INR(num(receipt.amount))}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {receipt.receipt_number} • {receipt.mode}
          {receipt.reference_no ? ` • Ref: ${receipt.reference_no}` : ''}
        </p>
      </div>
      <div className="text-right">
        <p className="text-xs text-gray-500">
          {dt ? dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
        </p>
        <p className="text-xs text-gray-400">
          {dt ? dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
        </p>
      </div>
    </div>
  );
}

function PaymentHistory({ studentId }) {
  const { data: receipts = [], isLoading, error } = useReceipts(studentId);

  if (isLoading) {
    return <div className="px-5 py-6 text-center text-sm text-gray-400">Loading payment history...</div>;
  }
  if (error) {
    return <div className="px-5 py-6 text-center text-sm text-red-500">Couldn't load payment history.</div>;
  }
  if (receipts.length === 0) {
    return <div className="px-5 py-6 text-center text-sm text-gray-400">No payments recorded yet.</div>;
  }

  return (
    <div className="divide-y divide-gray-50">
      {receipts.map(r => <ReceiptRow key={r.id} receipt={r} />)}
    </div>
  );
}

// Fee summary card — identical shape to the one on the Dashboard tab, so a
// student looks the same no matter which tab you found them from.
function StudentFeeSummaryCard({ student, onBack }) {
  const { data: summary, isLoading, error } = useStudentFeeSummary(student.id);
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="card !p-0 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-300 hover:text-gray-500 transition mr-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] font-bold shrink-0">
            {(student.student_name || '?')[0].toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-[var(--color-text)]">{student.student_name}</p>
            <p className="text-xs text-gray-400">
              {student.student_group_name} • {student.section_name} • {student.admission_number}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowDetails(v => !v)}
          className="text-xs font-medium text-[var(--color-primary)] hover:underline shrink-0"
        >
          {showDetails ? 'Hide Details' : 'View Details'}
        </button>
      </div>

      {isLoading ? (
        <div className="px-5 py-8 text-center text-sm text-gray-400">Loading fee summary...</div>
      ) : error ? (
        <div className="px-5 py-8 text-center text-sm text-red-500">
          Couldn't load fee summary. {error?.readableMessage || ''}
        </div>
      ) : (
        <div className="grid grid-cols-3 divide-x divide-gray-100">
          <div className="px-5 py-4 text-center">
            <p className="text-lg font-bold text-[var(--color-text)]">{INR(num(summary?.total_due))}</p>
            <p className="text-xs text-gray-400 mt-0.5">Total Due</p>
          </div>
          <div className="px-5 py-4 text-center">
            <p className="text-lg font-bold text-emerald-600">{INR(num(summary?.total_paid))}</p>
            <p className="text-xs text-gray-400 mt-0.5">Paid</p>
          </div>
          <div className="px-5 py-4 text-center">
            <p className={`text-lg font-bold ${num(summary?.balance) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {INR(num(summary?.balance))}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Balance</p>
          </div>
        </div>
      )}

      {showDetails && (
        <div className="border-t border-gray-100">
          <div className="px-5 py-3 bg-gray-50/60">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment History</p>
          </div>
          <PaymentHistory studentId={student.id} />
        </div>
      )}
    </div>
  );
}

// One student row in the live search results dropdown.
function StudentResultRow({ student, onSelect }) {
  return (
    <button
      onClick={() => onSelect(student)}
      className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] font-bold text-sm shrink-0">
          {(student.student_name || '?')[0].toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--color-text)]">{student.student_name}</p>
          <p className="text-xs text-gray-400">
            {student.student_group_name} • {student.section_name}
          </p>
        </div>
      </div>
      <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

// Live-as-you-type search box. Same behavior as the Dashboard tab's search,
// so students can be found here too without switching tabs.
function StudentSearchBox({ searchTerm, setSearchTerm, onSelectStudent }) {
  const { data: searchResults = [], isLoading: searching } = useStudentSearch(searchTerm);

  return (
    <div className="card !p-0 overflow-hidden">
      <div className="px-5 py-4">
        <label className="text-xs font-medium text-gray-400 mb-2 block">Search a student</label>
        <div className="relative">
          <svg className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Type a student's name..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
          />
        </div>
      </div>

      {searchTerm.trim().length > 0 && (
        <div className="border-t border-gray-100 max-h-72 overflow-y-auto">
          {searching ? (
            <div className="px-5 py-6 text-center text-sm text-gray-400">Searching...</div>
          ) : searchResults.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-gray-400">No students found for "{searchTerm}"</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {searchResults.map(s => (
                <StudentResultRow key={s.id} student={s} onSelect={onSelectStudent} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
function StudentRoster({ section, onSelectStudent }) {
  const { data: students = [], isLoading, error } = useStudentsBySection(section.section_id);

  if (isLoading) {
    return <div className="px-5 py-6 text-center text-sm text-gray-400">Loading students...</div>;
  }
  if (error) {
    return <div className="px-5 py-6 text-center text-sm text-red-500">Couldn't load students.</div>;
  }
  if (students.length === 0) {
    return <div className="px-5 py-6 text-center text-sm text-gray-400">No students in this section.</div>;
  }

  return (
    <div className="divide-y divide-gray-50">
      {students.map(s => (
        <button
          key={s.id}
          onClick={() => onSelectStudent(s)}
          className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] font-bold text-sm shrink-0">
              {(s.student_name || '?')[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-text)]">{s.student_name}</p>
              <p className="text-xs text-gray-400">{s.admission_number}</p>
            </div>
          </div>
          <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      ))}
    </div>
  );
}

// One section row inside an expanded class — name + student count, expands to roster.
function SectionRow({ section, expanded, onToggle, onSelectStudent }) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50/60 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <p className="font-medium text-sm text-[var(--color-text)]">{section.section_name}</p>
        </div>
        <span className="text-xs text-gray-400">{section.student_count} students</span>
      </button>
      {expanded && (
        <div className="border-t border-gray-100">
          <StudentRoster section={section} onSelectStudent={onSelectStudent} />
        </div>
      )}
    </div>
  );
}

// One class group — expands to list its sections (each independently expandable).
function ClassGroup({ classData, expanded, onToggle, expandedSections, onToggleSection, onSelectStudent }) {
  const totalStudents = classData.sections.reduce((sum, s) => sum + num(s.student_count), 0);

  return (
    <div className="card !p-0 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50/60 transition-colors text-left"
      >
        <div className="flex items-center gap-4">
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <div>
            <p className="font-bold text-[var(--color-text)]">{classData.class_name}</p>
            <p className="text-xs text-gray-400">{totalStudents} students • {classData.sections.length} sections</p>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 pt-1 space-y-2 border-t border-gray-100">
          {classData.sections.map(section => (
            <div key={section.section_id} className="pt-2">
              <SectionRow
                section={section}
                expanded={expandedSections.has(section.section_id)}
                onToggle={() => onToggleSection(section.section_id)}
                onSelectStudent={onSelectStudent}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FeeStudentView() {
  const { selectedYear } = useAcademicYear();
  const [expandedClasses, setExpandedClasses] = useState(new Set());
  const [expandedSections, setExpandedSections] = useState(new Set());
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: classSummary = [], isLoading, error, refetch } = useClassSummary(selectedYear);

  const toggleClass = (classId) => {
    setExpandedClasses(prev => {
      const next = new Set(prev);
      next.has(classId) ? next.delete(classId) : next.add(classId);
      return next;
    });
  };

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(sectionId) ? next.delete(sectionId) : next.add(sectionId);
      return next;
    });
  };

  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
  };

  const handleBack = () => {
    setSelectedStudent(null);
    setSearchTerm('');
  };

  if (selectedStudent) {
    return (
      <StudentFeeSummaryCard student={selectedStudent} onBack={handleBack} />
    );
  }

  return (
    <div className="space-y-5">
      <StudentSearchBox
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onSelectStudent={handleSelectStudent}
      />

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-28 gap-3">
          <div className="w-10 h-10 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--color-text-secondary)]">Loading classes...</p>
        </div>
      ) : error ? (
        <div className="flex items-center justify-between gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm">
          <div className="flex items-center gap-2">
            <span className="text-red-500 font-bold">!</span>
            <span className="text-red-700">{error?.readableMessage || 'Failed to load classes'}</span>
          </div>
          <button onClick={() => refetch()}
            className="px-3 py-1 text-xs font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition">
            Retry
          </button>
        </div>
      ) : classSummary.length === 0 ? (
        <div className="card text-center py-10 text-sm text-gray-400">
          No classes found for this academic year.
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Or browse by class and section below.
          </p>
          {classSummary.map(c => (
            <ClassGroup
              key={c.class_id}
              classData={c}
              expanded={expandedClasses.has(c.class_id)}
              onToggle={() => toggleClass(c.class_id)}
              expandedSections={expandedSections}
              onToggleSection={toggleSection}
              onSelectStudent={handleSelectStudent}
            />
          ))}
        </div>
      )}
    </div>
  );
}