import { useState } from 'react';
import { useAcademicYear } from '../../context/AcademicYearContext';
import { useClassSummary, useStudentSearch, useStudentFeeSummary, INR } from '../../hooks/useFees';

// The backend returns billed/collected/outstanding as Decimal, which FastAPI
// serializes to JSON as strings (e.g. "12600.00"), not numbers. Adding those
// directly with `+` produces NaN/garbage, so every numeric read goes through
// this first.
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// One student row in the search results dropdown — shows name, class/section,
// and fires onSelect when clicked.
function StudentResultRow({ student, onSelect }) {
  return (
    <button
      onClick={() => onSelect(student)}
      className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] font-bold text-sm shrink-0">
          {(student.student_name || student.first_name || '?')[0].toUpperCase()}
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

// Fee summary card shown after a student is selected from search.
function StudentFeeSummaryCard({ student, onClear }) {
  const { selectedYear } = useAcademicYear();
  const { data: summary, isLoading, error } = useStudentFeeSummary(student.id, selectedYear);

  return (
    <div className="card !p-0 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
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
        <button onClick={onClear} className="text-gray-300 hover:text-gray-500 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
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
    </div>
  );
}

// One section's card inside a class group — student count + billed/collected/outstanding.
function SectionCard({ section }) {
  const collected = num(section.total_collected);
  const billed = num(section.total_billed);
  const outstanding = num(section.total_outstanding);
  const pct = billed > 0 ? Math.round((collected / billed) * 100) : 0;

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold text-sm text-[var(--color-text)]">{section.section_name}</p>
        <span className="text-xs text-gray-400">{section.student_count} students</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-3">
        <div className="h-full bg-emerald-400 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-gray-400">Billed</p>
          <p className="font-semibold text-[var(--color-text)]">{INR(billed)}</p>
        </div>
        <div>
          <p className="text-gray-400">Collected</p>
          <p className="font-semibold text-emerald-600">{INR(collected)}</p>
        </div>
        <div className="col-span-2">
          <p className="text-gray-400">Outstanding</p>
          <p className="font-semibold text-red-600">{INR(outstanding)}</p>
        </div>
      </div>
    </div>
  );
}

// One class group — header with class-level totals, expandable to show sections.
function ClassGroup({ classData, expanded, onToggle }) {
  const totals = classData.sections.reduce(
    (acc, s) => ({
      students: acc.students + num(s.student_count),
      billed: acc.billed + num(s.total_billed),
      collected: acc.collected + num(s.total_collected),
      outstanding: acc.outstanding + num(s.total_outstanding),
    }),
    { students: 0, billed: 0, collected: 0, outstanding: 0 }
  );

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
            <p className="text-xs text-gray-400">{totals.students} students • {classData.sections.length} sections</p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="text-right">
            <p className="font-semibold text-[var(--color-text)]">{INR(totals.billed)}</p>
            <p className="text-xs text-gray-400">Billed</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-emerald-600">{INR(totals.collected)}</p>
            <p className="text-xs text-gray-400">Collected</p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="font-semibold text-red-600">{INR(totals.outstanding)}</p>
            <p className="text-xs text-gray-400">Outstanding</p>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 pt-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 border-t border-gray-100">
          {classData.sections.map(section => (
            <div key={section.section_id} className="pt-3">
              <SectionCard section={section} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FeesDashboard() {
  const { selectedYear } = useAcademicYear();
  const [expandedClasses, setExpandedClasses] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);

  const { data: classSummary = [], isLoading: loadingSummary, error: summaryError, refetch } =
    useClassSummary(selectedYear);

  const { data: searchResults = [], isLoading: searching } = useStudentSearch(searchTerm);

  const toggleClass = (classId) => {
    setExpandedClasses(prev => {
      const next = new Set(prev);
      next.has(classId) ? next.delete(classId) : next.add(classId);
      return next;
    });
  };

  const schoolTotals = classSummary.reduce(
    (acc, c) => {
      c.sections.forEach(s => {
        acc.students += num(s.student_count);
        acc.billed += num(s.total_billed);
        acc.collected += num(s.total_collected);
        acc.outstanding += num(s.total_outstanding);
      });
      return acc;
    },
    { students: 0, billed: 0, collected: 0, outstanding: 0 }
  );

  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="card !p-0 overflow-hidden relative">
        <div className="px-5 py-4">
          <label className="text-xs font-medium text-gray-400 mb-2 block">Search a student</label>
          <div className="relative">
            <svg className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setSelectedStudent(null); }}
              placeholder="Type a student's name..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
            />
          </div>
        </div>

        {/* Live results dropdown */}
        {searchTerm.trim().length > 0 && !selectedStudent && (
          <div className="border-t border-gray-100 max-h-72 overflow-y-auto">
            {searching ? (
              <div className="px-5 py-6 text-center text-sm text-gray-400">Searching...</div>
            ) : searchResults.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-gray-400">No students found for "{searchTerm}"</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {searchResults.map(s => (
                  <StudentResultRow key={s.id} student={s} onSelect={(student) => { setSelectedStudent(student); setSearchTerm(student.student_name); }} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected student's fee summary */}
      {selectedStudent && (
        <StudentFeeSummaryCard
          student={selectedStudent}
          onClear={() => { setSelectedStudent(null); setSearchTerm(''); }}
        />
      )}

      {/* School-wide totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border bg-gradient-to-br from-gray-50 to-gray-100 text-gray-700 border-gray-200 p-4">
          <div className="text-2xl font-bold leading-tight">{schoolTotals.students}</div>
          <div className="text-xs font-medium opacity-70 mt-1">Total Students</div>
        </div>
        <div className="rounded-2xl border bg-gradient-to-br from-[#E8F9ED] to-[#BBF7D0] text-[#2ED05D] border-[#BBF7D0] p-4">
          <div className="text-2xl font-bold leading-tight">{INR(schoolTotals.billed)}</div>
          <div className="text-xs font-medium opacity-70 mt-1">Total Billed</div>
        </div>
        <div className="rounded-2xl border bg-gradient-to-br from-emerald-50 to-green-100 text-emerald-700 border-emerald-200 p-4">
          <div className="text-2xl font-bold leading-tight">{INR(schoolTotals.collected)}</div>
          <div className="text-xs font-medium opacity-70 mt-1">Collected</div>
        </div>
        <div className="rounded-2xl border bg-gradient-to-br from-red-50 to-rose-100 text-red-700 border-red-200 p-4">
          <div className="text-2xl font-bold leading-tight">{INR(schoolTotals.outstanding)}</div>
          <div className="text-xs font-medium opacity-70 mt-1">Outstanding</div>
        </div>
      </div>

      {/* Class/section breakdown */}
      {loadingSummary ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--color-text-secondary)]">Loading class summary...</p>
        </div>
      ) : summaryError ? (
        <div className="flex items-center justify-between gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm">
          <div className="flex items-center gap-2">
            <span className="text-red-500 font-bold">!</span>
            <span className="text-red-700">{summaryError?.readableMessage || 'Failed to load class summary'}</span>
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
          {classSummary.map(c => (
            <ClassGroup
              key={c.class_id}
              classData={c}
              expanded={expandedClasses.has(c.class_id)}
              onToggle={() => toggleClass(c.class_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}