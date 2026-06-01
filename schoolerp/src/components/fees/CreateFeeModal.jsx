import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAcademicYear } from '../../context/AcademicYearContext';
import { useSettings } from '../../context/SettingsContext';
import { useCreateFee, useFeeCategories, useAllStudents, useStudentsForProgram, useProgramEnrollment, useFeeStructureFor, INR } from '../../hooks/useFees';
import { getList, getDocStrict } from '../../api/frappe';
import EnrollStudentModal from './EnrollStudentModal';

export default function CreateFeeModal({ onClose, onCreated }) {
  const { selectedYear } = useAcademicYear();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [showEnroll, setShowEnroll] = useState(false);
  const [error, setError] = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  const [form, setForm] = useState({
    student: '',
    program: '',
    academic_year: selectedYear || '',
    due_date: '',
    posting_date: new Date().toISOString().split('T')[0],
    components: [{ fees_category: '', amount: '', discount: 0 }],
  });

  const { data: programs = [] } = useQuery({
    queryKey: ['Program', 'list'],
    queryFn: () => getList('Program', [], ['name', 'program_name'], 100),
  });

  const { data: academicYears = [] } = useQuery({
    queryKey: ['Academic Year', 'list'],
    queryFn: () => getList('Academic Year', [], ['name'], 50),
  });

  const { data: categories = [] } = useFeeCategories({ retry: false });

  // Fetch students scoped to selected program + academic year via Student Groups
  const { data: programStudents = [], isLoading: loadingProgramStudents } = useStudentsForProgram(form.program, form.academic_year, { enabled: !!form.program });
  // Fetch all students for customer lookup
  const { data: allStudents = [] } = useAllStudents();

  // Fetch Program Enrollment for selected student + year
  const { data: enrollment, isLoading: loadingEnrollment } = useProgramEnrollment(form.student, form.academic_year);

  // Fetch Fee Structure for selected program + year
  const { data: feeStructure, isLoading: loadingFeeStructure } = useFeeStructureFor(form.program, form.academic_year, { enabled: !!form.program && !!form.academic_year });

  // Fetch full structure doc for components
  const { data: fullStructure } = useQuery({
    queryKey: ['Fee Structure', 'full', feeStructure?.name],
    queryFn: () => getDocStrict('Fee Structure', feeStructure.name),
    enabled: !!feeStructure?.name,
  });

  // Auto-populate components from Fee Structure when available
  useEffect(() => {
    if (fullStructure?.components?.length > 0) {
      const isDefault = form.components.length === 1 && !form.components[0].fees_category;
      if (isDefault) {
        setForm(f => ({
          ...f,
          components: fullStructure.components.map(c => ({
            fees_category: c.fees_category || '',
            amount: c.amount || '',
            discount: c.discount || 0,
          })),
        }));
      }
    }
  }, [fullStructure]);

  const settings = useSettings();
  const structureLocked = !!fullStructure?.components?.length;

  // Build the student list: program-scoped students with customer from allStudents
  const studentOptions = programStudents.map(ps => {
    const full = allStudents.find(s => s.name === ps.student);
    return {
      student: ps.student,
      student_name: ps.student_name,
      customer: full?.customer || '',
    };
  });

  const createMutation = useCreateFee();

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addComponent = () =>
    setForm(f => ({ ...f, components: [...f.components, { fees_category: '', amount: '', discount: 0 }] }));

  const removeComponent = (i) =>
    setForm(f => ({ ...f, components: f.components.filter((_, idx) => idx !== i) }));

  const setComponent = (i, k, v) =>
    setForm(f => {
      const c = [...f.components];
      c[i] = { ...c[i], [k]: v };
      return { ...f, components: c };
    });

  const grandTotal = form.components.reduce((s, c) => {
    const amt = parseFloat(c.amount) || 0;
    const disc = parseFloat(c.discount) || 0;
    return s + (amt - disc);
  }, 0);

  const sortedPrograms = [...programs].sort((a, b) => {
    const n = s => parseInt((s || '').match(/\d+/)?.[0] || 0);
    return n(a.program_name || a.name) - n(b.program_name || b.name);
  });

  const canNext1 = form.program && form.student && form.academic_year && !loadingEnrollment && !!enrollment && !loadingFeeStructure && !!feeStructure;
  const canNext2 = form.components.every(c => c.fees_category && c.amount);

  const handleSave = async () => {
    if (!canNext1 || !canNext2) {
      setError('Please fill all required fields.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const selectedStudent = studentOptions.find(s => s.student === form.student);
      if (!selectedStudent?.customer) {
        setError('Selected student has no linked Customer account. Please create a Customer for this student in ERPNext first.');
        setSaving(false);
        return;
      }
      if (!enrollment?.name) {
        setError('No approved Program Enrollment found for this student and academic year. Please enroll the student first.');
        setSaving(false);
        return;
      }
      const payload = {
        doctype: 'Fees',
        naming_series: 'EDU-FEE-.YYYY.-',
        student: form.student,
        student_name: selectedStudent?.student_name || form.student,
        customer: selectedStudent.customer,
        program_enrollment: enrollment.name,
        fee_structure: feeStructure?.name || '',
        program: form.program || undefined,
        academic_year: form.academic_year,
        due_date: form.due_date || undefined,
        posting_date: form.posting_date,
        company: settings.company || 'Syncocept',
        receivable_account: 'Debtors - S',
        cost_center: 'Main - S',
        components: form.components.map((c, i) => {
          const amt = parseFloat(c.amount) || 0;
          const disc = parseFloat(c.discount) || 0;
          return {
            doctype: 'Fee Component',
            fees_category: c.fees_category,
            amount: amt,
            discount: disc,
            total: amt - disc,
            item: c.fees_category,
            idx: i + 1,
          };
        }),
      };

      await createMutation.mutateAsync(payload);
      onCreated();
    } catch (err) {
      setError(err.readableMessage || err.response?.data?.message || 'Failed to create fee invoice.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text)]">New Fee Invoice</h2>
            <p className="text-xs text-gray-400 mt-0.5">Step {step} of 2</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 group">
            <span className="w-5 h-5 rounded-full bg-black/5 flex items-center justify-center group-hover:bg-black/10 transition-all duration-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
          </button>
        </div>

        {/* Step progress */}
        <div className="flex">
          {[1, 2].map(s => (
            <div key={s} className={`flex-1 h-1 transition-all ${step >= s ? 'bg-[var(--color-primary)]' : 'bg-gray-100'}`} />
          ))}
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100">{error}</div>}

          {/* Step 1: Student & Program */}
          {step === 1 && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                  Program <span className="text-red-500">*</span>
                </label>
                <select value={form.program}
                  onChange={e => { setField('program', e.target.value); setField('student', ''); }}
                  className="input w-full text-sm">
                  <option value="">Select Program</option>
                  {sortedPrograms.map(p => (
                    <option key={p.name} value={p.name}>{p.program_name || p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                  Student <span className="text-red-500">*</span>
                </label>
                {!form.program ? (
                  <p className="text-sm text-gray-400 italic">Select a program first</p>
                ) : loadingProgramStudents ? (
                  <p className="text-sm text-gray-400 italic">Loading students...</p>
                ) : (
                  <select value={form.student} onChange={e => setField('student', e.target.value)}
                    className="input w-full text-sm">
                    <option value="">{studentOptions.length === 0 ? 'No students in this program' : 'Select Student'}</option>
                    {studentOptions.map(s => (
                      <option key={s.student} value={s.student}>{s.student_name} ({s.student})</option>
                    ))}
                  </select>
                )}
                {form.program && !loadingProgramStudents && studentOptions.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">No students found in this program. Add students to a Student Group first.</p>
                )}
                {form.student && form.academic_year && (
                  loadingEnrollment ? (
                    <p className="text-xs text-gray-400 mt-1">Looking up enrollment...</p>
                  ) : !enrollment ? (
                    <p className="text-xs text-red-500 mt-1">
                      No enrollment found for {form.academic_year}.{' '}
                      <button type="button" onClick={() => setShowEnroll(true)}
                        className="text-[var(--color-primary)] font-semibold hover:underline">
                        Enroll now
                      </button>
                    </p>
                  ) : (
                    <p className="text-xs text-emerald-600 mt-1">Enrolled: {enrollment.name} ({enrollment.program})</p>
                  )
                )}
                {form.program && form.academic_year && (
                  loadingFeeStructure ? (
                    <p className="text-xs text-gray-400 mt-1">Looking up fee structure...</p>
                  ) : !feeStructure ? (
                    <p className="text-xs text-red-500 mt-1">No approved Fee Structure found for {form.program} in {form.academic_year}. Create one in ERPNext first.</p>
                  ) : (
                    <p className="text-xs text-emerald-600 mt-1">Fee Structure: {feeStructure.name} (₹{feeStructure.total_amount})</p>
                  )
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                  Academic Year <span className="text-red-500">*</span>
                </label>
                <select value={form.academic_year} onChange={e => setField('academic_year', e.target.value)}
                  className="input w-full text-sm">
                  <option value="">Select Academic Year</option>
                  {academicYears.map(y => <option key={y.name} value={y.name}>{y.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Posting Date</label>
                  <input type="date" value={form.posting_date}
                    onChange={e => setField('posting_date', e.target.value)}
                    className="input w-full text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Due Date</label>
                  <input type="date" value={form.due_date}
                    onChange={e => setField('due_date', e.target.value)}
                    className="input w-full text-sm" />
                </div>
              </div>
            </>
          )}

          {/* Step 2: Fee Components */}
          {step === 2 && (
            <>
              <p className="text-sm text-gray-500">
                Add fee components for <span className="font-semibold text-[var(--color-text)]">
                  {allStudents.find(s => s.name === form.student)?.student_name || form.student}
                </span>
              </p>

              {structureLocked && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
                  Amounts are locked to Fee Structure <span className="font-semibold">{feeStructure.name}</span>. Adjust discount per student if needed.
                </div>
              )}

              <div className="space-y-3">
                {form.components.map((comp, i) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-400 mb-1">Fee Category</label>
                        {categories.length > 0 ? (
                          <select value={comp.fees_category}
                            onChange={e => setComponent(i, 'fees_category', e.target.value)}
                            disabled={structureLocked}
                            className={`input w-full text-sm ${structureLocked ? 'opacity-60 cursor-not-allowed bg-gray-100' : ''}`}>
                            <option value="">Select Category</option>
                            {categories.map(c => <option key={c.name} value={c.name}>{c.category_name || c.name}</option>)}
                          </select>
                        ) : (
                          <input type="text" placeholder="e.g. Tuition Fee"
                            value={comp.fees_category}
                            onChange={e => setComponent(i, 'fees_category', e.target.value)}
                            disabled={structureLocked}
                            className={`input w-full text-sm ${structureLocked ? 'opacity-60 cursor-not-allowed bg-gray-100' : ''}`} />
                        )}
                      </div>
                      <div className="w-24">
                        <label className="block text-xs text-gray-400 mb-1">Amount</label>
                        <input type="number" placeholder="0" value={comp.amount}
                          onChange={e => setComponent(i, 'amount', e.target.value)}
                          disabled={structureLocked}
                          className={`input w-full text-sm ${structureLocked ? 'opacity-60 cursor-not-allowed bg-gray-100' : ''}`} />
                      </div>
                      <div className="w-20">
                        <label className="block text-xs text-gray-400 mb-1">Discount</label>
                        <input type="number" placeholder="0" value={comp.discount}
                          onChange={e => setComponent(i, 'discount', e.target.value)}
                          className="input w-full text-sm" />
                      </div>
                      {form.components.length > 1 && !structureLocked && (
                        <button onClick={() => removeComponent(i)} className="mt-4 text-red-400 hover:text-red-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <div className="flex justify-end text-xs text-gray-400 mt-1">
                      Net: {INR((parseFloat(comp.amount) || 0) - (parseFloat(comp.discount) || 0))}
                    </div>
                  </div>
                ))}
              </div>

              {!structureLocked && (
                <button onClick={addComponent}
                  className="flex items-center gap-1.5 text-sm text-[var(--color-primary)] hover:underline font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Component
                </button>
              )}

              <div className="flex items-center justify-between p-4 bg-[var(--color-primary)]/5 rounded-xl border border-[var(--color-primary)]/20">
                <span className="font-semibold text-[var(--color-text)]">Grand Total</span>
                <span className="text-xl font-bold text-[var(--color-primary)]">{INR(grandTotal)}</span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <button onClick={step === 1 ? onClose : () => setStep(s => s - 1)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step < 2 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canNext1}
              className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">
              Next
            </button>
          ) : (
            <button onClick={handleSave} disabled={saving || !canNext2}
              className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50 flex items-center gap-2 group">
              {saving ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Creating...</>
              ) : 'Create Invoice'}
            </button>
          )}
        </div>
      </div>

      {/* Enroll Student Modal (overlay) */}
      {showEnroll && (
        <EnrollStudentModal
          student={studentOptions.find(s => s.student === form.student) || { name: form.student }}
          onClose={() => setShowEnroll(false)}
          onEnrolled={() => {
            setShowEnroll(false);
            // React Query will auto-refetch enrollment on re-render
          }}
        />
      )}
    </div>
  );
}
