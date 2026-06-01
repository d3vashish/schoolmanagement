import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAcademicYear } from '../../context/AcademicYearContext';
import { useFeeStructures, useCreateFeeSchedule, useEnrollmentsWithConcession, INR } from '../../hooks/useFees';
import { getList, getDoc } from '../../api/frappe';

export default function GenerateFeesModal({ onClose, onGenerated }) {
  const { selectedYear } = useAcademicYear();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const [form, setForm] = useState({
    fee_structure: '',
    student_groups: [],
    due_date: '',
    posting_date: new Date().toISOString().split('T')[0],
  });

  const yearFilter = selectedYear ? [['academic_year', '=', selectedYear]] : [];
  const { data: structures = [] } = useFeeStructures(yearFilter);

  const selectedStructure = structures.find(s => s.name === form.fee_structure);

  // Fetch student groups for the selected structure's program (no year filter — groups may span years)
  const { data: studentGroups = [] } = useQuery({
    queryKey: ['Student Groups', 'for-program', selectedStructure?.program],
    queryFn: () => getList('Student Group', [['program', '=', selectedStructure.program]], ['name', 'student_group_name', 'academic_year'], 50),
    enabled: !!selectedStructure?.program,
  });

  // Preview students count
  const { data: previewStudents = [], isLoading: loadingPreview } = useQuery({
    queryKey: ['GeneratePreview', form.fee_structure, form.student_groups.join(',')],
    queryFn: async () => {
      const allStudents = [];
      for (const groupName of form.student_groups) {
        try {
          const doc = await getDoc('Student Group', groupName);
          (doc.students || []).filter(s => s.active).forEach(s => {
            if (!allStudents.find(x => x.student === s.student))
              allStudents.push({ student: s.student, student_name: s.student_name });
          });
        } catch (e) { /* skip */ }
      }
      return allStudents;
    },
    enabled: form.student_groups.length > 0,
  });

  // Fetch enrollments with concession data
  const { data: enrollments = [] } = useEnrollmentsWithConcession(
    selectedStructure?.program, selectedYear
  );
  const concessionCount = enrollments.filter(e => (e.concession_percent || 0) > 0).length;

  const mutation = useCreateFeeSchedule();

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleGroup = (name) => {
    setForm(f => ({
      ...f,
      student_groups: f.student_groups.includes(name)
        ? f.student_groups.filter(g => g !== name)
        : [...f.student_groups, name],
    }));
  };

  const canNext1 = form.fee_structure;
  const canNext2 = form.student_groups.length > 0;
  const canNext3 = form.due_date;

  const handleGenerate = async () => {
    if (!form.fee_structure || form.student_groups.length === 0 || !form.due_date) {
      setError('Please fill all required fields.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const doc = await mutation.mutateAsync({
        doctype: 'Fee Schedule',
        naming_series: 'EDU-FSD-.YYYY.-',
        based_on: 'Fee Structure',
        fee_structure: form.fee_structure,
        student_groups: form.student_groups.map(g => ({
          doctype: 'Fee Schedule Student Group',
          student_group: g,
        })),
        due_date: form.due_date,
        posting_date: form.posting_date,
      });

      setResult({
        success: true,
        message: `Fee Schedule created and submitted. ${previewStudents.length} students will receive invoices.`,
        name: doc?.name,
      });
    } catch (err) {
      setResult({
        success: false,
        message: err.readableMessage || err.response?.data?.message || 'Failed to generate fees.',
      });
    } finally {
      setSaving(false);
    }
  };

  const totalAmount = (selectedStructure?.total_amount || 0) * previewStudents.length;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text)]">Generate Fees</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {result ? 'Result' : `Step ${step} of 3`}
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

        {/* Step progress */}
        {!result && (
          <div className="flex">
            {[1, 2, 3].map(s => (
              <div key={s} className={`flex-1 h-1 transition-all ${step >= s ? 'bg-[var(--color-primary)]' : 'bg-gray-100'}`} />
            ))}
          </div>
        )}

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100">{error}</div>}

          {/* Result */}
          {result ? (
            <div className="text-center py-6">
              <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center text-3xl mb-4 ${
                result.success ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
              }`}>
                {result.success ? '✅' : '❌'}
              </div>
              <p className={`font-bold text-lg ${result.success ? 'text-emerald-700' : 'text-red-700'}`}>
                {result.success ? 'Fees Generated!' : 'Generation Failed'}
              </p>
              <p className="text-sm text-gray-500 mt-2">{result.message}</p>
              {result.name && (
                <p className="text-xs text-gray-400 mt-1">Schedule: {result.name}</p>
              )}
            </div>
          ) : (
            <>
              {/* Step 1: Select Structure */}
              {step === 1 && (
                <>
                  <p className="text-sm text-gray-500">Select a fee structure to use as the template for generating invoices.</p>

                  {structures.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-400">No fee structures found for the selected academic year.</p>
                      <p className="text-xs text-gray-400 mt-1">Create a Fee Structure first in the Structures tab.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {structures.filter(s => s.docstatus === 1).map(s => (
                        <button key={s.name}
                          onClick={() => setField('fee_structure', s.name)}
                          className={`w-full text-left p-4 rounded-xl border transition-all ${
                            form.fee_structure === s.name
                              ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 ring-1 ring-[var(--color-primary)]/20'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-[var(--color-text)]">{s.program}</p>
                              <p className="text-xs text-gray-400">{s.name} • {s.academic_year}</p>
                            </div>
                            <span className="text-lg font-bold text-[var(--color-primary)]">{INR(s.total_amount)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Step 2: Select Student Groups */}
              {step === 2 && (
                <>
                  <p className="text-sm text-gray-500">
                    Select student groups to generate invoices for.
                    <span className="font-medium text-[var(--color-text)]"> {selectedStructure?.program}</span>
                  </p>

                  {studentGroups.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-400">No student groups found for this program.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {studentGroups.map(g => (
                        <label key={g.name}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            form.student_groups.includes(g.name)
                              ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}>
                          <input type="checkbox"
                            checked={form.student_groups.includes(g.name)}
                            onChange={() => toggleGroup(g.name)}
                            className="w-4 h-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-[var(--color-text)]">{g.student_group_name || g.name}</p>
                            <p className="text-xs text-gray-400">{g.name}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}

                  {form.student_groups.length > 0 && (
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                      <p className="text-sm text-blue-700">
                        {loadingPreview ? 'Loading preview...' : (
                          <>
                            <span className="font-semibold">{previewStudents.length} students</span> selected
                            {selectedStructure && (
                              <> • Total: <span className="font-semibold">{INR(totalAmount)}</span></>
                            )}
                            {concessionCount > 0 && (
                              <> • <span className="text-emerald-700 font-semibold">{concessionCount} students</span> have concessions</>
                            )}
                          </>
                        )}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Step 3: Dates */}
              {step === 3 && (
                <>
                  <p className="text-sm text-gray-500">Set the dates for the generated fee invoices.</p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Posting Date</label>
                      <input type="date" value={form.posting_date}
                        onChange={e => setField('posting_date', e.target.value)}
                        className="input w-full text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                        Due Date <span className="text-red-500">*</span>
                      </label>
                      <input type="date" value={form.due_date}
                        onChange={e => setField('due_date', e.target.value)}
                        className="input w-full text-sm" />
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Generation Summary</p>
                    </div>
                    {[
                      { label: 'Fee Structure', value: selectedStructure?.name || '—' },
                      { label: 'Program', value: selectedStructure?.program || '—' },
                      { label: 'Student Groups', value: `${form.student_groups.length} selected` },
                      { label: 'Students', value: `${previewStudents.length} students` },
                      { label: 'Per Student', value: INR(selectedStructure?.total_amount) },
                      ...(concessionCount > 0 ? [{ label: 'Concessions', value: `${concessionCount} students with discounts` }] : []),
                      { label: 'Total Amount', value: INR(totalAmount), bold: true },
                    ].map(r => (
                      <div key={r.label} className="flex items-center justify-between px-4 py-3 text-sm border-b border-gray-50 last:border-0">
                        <span className="text-gray-400">{r.label}</span>
                        <span className={r.bold ? 'font-bold text-[var(--color-primary)]' : 'font-medium text-[var(--color-text)]'}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          {result ? (
            <button onClick={onGenerated || onClose}
              className="btn-primary px-5 py-2.5 text-sm">
              Done
            </button>
          ) : (
            <>
              <button onClick={step === 1 ? onClose : () => setStep(s => s - 1)}
                className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
                {step === 1 ? 'Cancel' : 'Back'}
              </button>
              {step < 3 ? (
                <button onClick={() => setStep(s => s + 1)} disabled={step === 1 ? !canNext1 : !canNext2}
                  className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">
                  Next
                </button>
              ) : (
                <button onClick={handleGenerate} disabled={saving || !canNext3}
                  className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50 flex items-center gap-2 group">
                  {saving ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Generating...</>
                  ) : 'Generate Fees'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
