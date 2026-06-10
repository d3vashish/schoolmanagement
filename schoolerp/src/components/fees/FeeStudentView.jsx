import { useState } from 'react';
import { useAllStudents } from '../../hooks/useFees';
import StudentLedger from './StudentLedger';
import RecordPaymentModal from './RecordPaymentModal';
import JournalEntryModal from './JournalEntryModal';

export default function FeeStudentView() {
  const [selectedStudent, setSelectedStudent] = useState('');
  const [search, setSearch] = useState('');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [journalModalOpen, setJournalModalOpen] = useState(false);
  const [dismissed, setDismissed] = useState(new Set());

  const { data: students = [], error: studentsError, refetch: refetchStudents } = useAllStudents();

  const filteredStudents = students.filter(s => {
    const q = search.toLowerCase();
    return !search || s.student_name?.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q);
  });

  const selectedStudentData = students.find(s => s.name === selectedStudent);

  return (
    <div className="space-y-5">
      {studentsError && !dismissed.has('students') && (
        <div className="flex items-center justify-between gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm">
          <div className="flex items-center gap-2">
            <span className="text-red-500 font-bold">!</span>
            <span className="text-red-700">{studentsError?.readableMessage || 'Failed to load students'}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => refetchStudents()}
              className="px-3 py-1 text-xs font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition">
              Retry
            </button>
            <button onClick={() => setDismissed(d => new Set(d).add('students'))}
              className="text-red-400 hover:text-red-600 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[250px] relative">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Select Student</label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" placeholder="Search by name or ID..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="input pl-9 text-sm" />
            </div>
            {search && filteredStudents.length > 0 && !selectedStudent && (
              <div className="absolute z-10 mt-1 w-full bg-white rounded-xl border shadow-lg max-h-60 overflow-y-auto">
                {filteredStudents.slice(0, 20).map(s => (
                  <button key={s.name}
                    onClick={() => { setSelectedStudent(s.name); setSearch(''); }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 border-b border-gray-50 last:border-0 transition">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] font-bold text-sm shrink-0">
                      {(s.student_name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text)]">{s.student_name}</p>
                      <p className="text-xs text-gray-400">{s.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedStudentData && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] font-bold">
                {(selectedStudentData.student_name || '?')[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)]">{selectedStudentData.student_name}</p>
                <p className="text-xs text-gray-400">{selectedStudentData.name}</p>
              </div>
              <button onClick={() => setSelectedStudent('')}
                className="ml-2 text-gray-400 hover:text-gray-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {selectedStudent ? (
        <StudentLedger
          studentId={selectedStudent}
          onRecordPayment={() => setPaymentModalOpen(true)}
          onJournalAdjust={() => setJournalModalOpen(true)}
        />
      ) : (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center text-4xl mb-4 border border-blue-100">👤</div>
          <p className="font-bold text-[var(--color-text)] text-lg">Select a student</p>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1 max-w-xs">
            Search and select a student to view their complete fee ledger, payment history, and outstanding balance.
          </p>
        </div>
      )}

      {paymentModalOpen && (
        <RecordPaymentModal
          studentId={selectedStudent}
          onClose={() => setPaymentModalOpen(false)}
          onSaved={() => setPaymentModalOpen(false)}
        />
      )}

      {journalModalOpen && (
        <JournalEntryModal
          studentId={selectedStudent}
          onClose={() => setJournalModalOpen(false)}
          onSaved={() => setJournalModalOpen(false)}
        />
      )}
    </div>
  );
}


