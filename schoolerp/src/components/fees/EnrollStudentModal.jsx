import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAcademicYear } from '../../context/AcademicYearContext';
import { useCreateEnrollment, useStudentEnrollments } from '../../hooks/useFees';
import { getList } from '../../api/frappe';

export default function EnrollStudentModal({ student, onClose, onEnrolled }) {
  const { selectedYear } = useAcademicYear();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    program: '',
    academic_year: selectedYear || '',
    enrollment_date: new Date().toISOString().split('T')[0],
  });

  const { data: programs = [] } = useQuery({
    queryKey: ['Program', 'list'],
    queryFn: () => getList('Program', [], ['name', 'program_name'], 100),
  });

  const { data: academicYears = [] } = useQuery({
    queryKey: ['Academic Year', 'list'],
    queryFn: () => getList('Academic Year', [], ['name'], 50),
  });

  // Show existing enrollments for context
  const { data: existingEnrollments = [] } = useStudentEnrollments(student?.name);

  const createMutation = useCreateEnrollment();

  const sortedPrograms = [...programs].sort((a, b) => {
    const n = s => parseInt((s || '').match(/\d+/)?.[0] || 0);
    return n(a.program_name || a.name) - n(b.program_name || b.name);
  });

  const canSubmit = form.program && form.academic_year && form.enrollment_date;

  // Check if already enrolled in same program+year
  const duplicate = existingEnrollments.find(
    e => e.program === form.program && e.academic_year === form.academic_year
  );

  const handleSubmit = async () => {
    if (!canSubmit || duplicate) return;
    setSaving(true);
    setError('');
    try {
      // Creates draft + submits atomically via run_doc_method
      await createMutation.mutateAsync({
        student: student.name,
        student_name: student.student_name || `${student.first_name || ''} ${student.last_name || ''}`.trim(),
        program: form.program,
        academic_year: form.academic_year,
        enrollment_date: form.enrollment_date,
      });
      onEnrolled?.();
    } catch (err) {
      setError(err.readableMessage || err.response?.data?.message || 'Failed to enroll student.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text)]">Enroll Student</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {student?.student_name || student?.name}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 group">
            <span className="w-5 h-5 rounded-full bg-black/5 flex items-center justify-center group-hover:bg-black/10 transition-all duration-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100">{error}</div>}

          {/* Existing enrollments */}
          {existingEnrollments.length > 0 && (
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Existing Enrollments</p>
              <div className="space-y-1">
                {existingEnrollments.map(e => (
                  <div key={e.name} className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-text)]">{e.program} &mdash; {e.academic_year}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      e.docstatus === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {e.docstatus === 1 ? 'Submitted' : 'Draft'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Program */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Program <span className="text-red-500">*</span>
            </label>
            <select value={form.program} onChange={e => setForm(f => ({ ...f, program: e.target.value }))}
              className="input w-full text-sm">
              <option value="">Select Program</option>
              {sortedPrograms.map(p => (
                <option key={p.name} value={p.name}>{p.program_name || p.name}</option>
              ))}
            </select>
          </div>

          {/* Academic Year */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Academic Year <span className="text-red-500">*</span>
            </label>
            <select value={form.academic_year} onChange={e => setForm(f => ({ ...f, academic_year: e.target.value }))}
              className="input w-full text-sm">
              <option value="">Select Academic Year</option>
              {academicYears.map(y => <option key={y.name} value={y.name}>{y.name}</option>)}
            </select>
          </div>

          {/* Enrollment Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Enrollment Date <span className="text-red-500">*</span>
            </label>
            <input type="date" value={form.enrollment_date}
              onChange={e => setForm(f => ({ ...f, enrollment_date: e.target.value }))}
              className="input w-full text-sm" />
          </div>

          {duplicate && (
            <div className="p-3 bg-amber-50 text-amber-700 text-sm rounded-xl border border-amber-200">
              This student is already enrolled in <strong>{form.program}</strong> for <strong>{form.academic_year}</strong> ({duplicate.name}).
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <button onClick={onClose}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving || !canSubmit || !!duplicate}
            className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50 flex items-center gap-2">
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Enrolling...</>
            ) : 'Enroll Student'}
          </button>
        </div>
      </div>
    </div>
  );
}
