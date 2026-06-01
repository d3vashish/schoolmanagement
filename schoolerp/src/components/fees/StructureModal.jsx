import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAcademicYear } from '../../context/AcademicYearContext';
import { useSettings } from '../../context/SettingsContext';
import {
  useFeeStructure, useCreateFeeStructure, useUpdateFeeStructure,
  useFeeCategories, useSubmitFeeStructure, INR,
} from '../../hooks/useFees';
import { getList } from '../../api/frappe';

export default function StructureModal({ editName, onClose, onSaved }) {
  const { selectedYear } = useAcademicYear();
  const settings = useSettings();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: existing } = useFeeStructure(editName);
  const { data: categories = [] } = useFeeCategories({ retry: false });
  const { data: programs = [] } = useQuery({
    queryKey: ['Program', 'list'],
    queryFn: () => getList('Program', [], ['name', 'program_name'], 100),
  });
  const { data: academicYears = [] } = useQuery({
    queryKey: ['Academic Year', 'list'],
    queryFn: () => getList('Academic Year', [], ['name'], 50),
  });

  const createMutation = useCreateFeeStructure();
  const updateMutation = useUpdateFeeStructure();
  const submitMutation = useSubmitFeeStructure();

  const [form, setForm] = useState({
    program: '',
    academic_year: selectedYear || '',
    academic_term: '',
    student_category: '',
    collection_frequency: 'Monthly',
    components: [{ fees_category: '', amount: '', discount: 0, item: '' }],
    receivable_account: 'Debtors - S',
    cost_center: 'Main - S',
    company: settings.company || 'Syncocept',
    enable_late_fee: false,
    late_fee_type: 'Fixed Amount',
    late_fee_amount: '',
    late_fee_percent: '',
    late_fee_grace_period_days: 0,
    late_fee_category: '',
  });

  // Populate form when editing
  useEffect(() => {
    if (existing) {
      setForm({
        program: existing.program || '',
        academic_year: existing.academic_year || '',
        academic_term: existing.academic_term || '',
        student_category: existing.student_category || '',
        collection_frequency: existing.collection_frequency || 'Monthly',
        components: (existing.components || []).map(c => ({
          fees_category: c.fees_category || '',
          amount: c.amount || '',
          discount: c.discount || 0,
          item: c.item || '',
        })),
        receivable_account: existing.receivable_account || 'Debtors - S',
        cost_center: existing.cost_center || 'Main - S',
        company: existing.company || 'Syncocept',
        enable_late_fee: !!existing.enable_late_fee,
        late_fee_type: existing.late_fee_type || 'Fixed Amount',
        late_fee_amount: existing.late_fee_amount || '',
        late_fee_percent: existing.late_fee_percent || '',
        late_fee_grace_period_days: existing.late_fee_grace_period_days || 0,
        late_fee_category: existing.late_fee_category || '',
      });
    }
  }, [existing]);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addComponent = () =>
    setForm(f => ({ ...f, components: [...f.components, { fees_category: '', amount: '', discount: 0, item: '' }] }));

  const removeComponent = (i) =>
    setForm(f => ({ ...f, components: f.components.filter((_, idx) => idx !== i) }));

  const setComponent = (i, k, v) =>
    setForm(f => {
      const c = [...f.components];
      c[i] = { ...c[i], [k]: v };
      // Auto-set item from category
      if (k === 'fees_category') {
        const cat = categories.find(cat => cat.name === v);
        if (cat?.item) c[i].item = cat.item;
      }
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

  const canNext1 = form.program && form.academic_year;
  const canNext2 = form.components.every(c => c.fees_category && c.amount);

  const handleSave = async (submit = false) => {
    if (!form.program || !form.academic_year) {
      setError('Program and Academic Year are required.');
      return;
    }
    if (form.components.some(c => !c.fees_category || !c.amount)) {
      setError('All components need a category and amount.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        doctype: 'Fee Structure',
        naming_series: 'EDU-FST-.YYYY.-',
        program: form.program,
        academic_year: form.academic_year,
        academic_term: form.academic_term || undefined,
        collection_frequency: form.collection_frequency,
        student_category: form.student_category || undefined,
        receivable_account: form.receivable_account,
        cost_center: form.cost_center,
        company: form.company,
        enable_late_fee: form.enable_late_fee ? 1 : 0,
        late_fee_type: form.enable_late_fee ? form.late_fee_type : undefined,
        late_fee_amount: form.enable_late_fee && form.late_fee_type === 'Fixed Amount' ? parseFloat(form.late_fee_amount) || 0 : undefined,
        late_fee_percent: form.enable_late_fee && form.late_fee_type === 'Percentage of Outstanding' ? parseFloat(form.late_fee_percent) || 0 : undefined,
        late_fee_grace_period_days: form.enable_late_fee ? parseInt(form.late_fee_grace_period_days) || 0 : undefined,
        late_fee_category: form.enable_late_fee ? form.late_fee_category || undefined : undefined,
        components: form.components.map((c, i) => {
          const amt = parseFloat(c.amount) || 0;
          const disc = parseFloat(c.discount) || 0;
          return {
            doctype: 'Fee Component',
            fees_category: c.fees_category,
            amount: amt,
            discount: disc,
            total: amt - disc,
            item: c.item || c.fees_category,
            idx: i + 1,
          };
        }),
      };

      if (editName) {
        await updateMutation.mutateAsync({ name: editName, data: payload });
        if (submit) {
          await submitMutation.mutateAsync(editName);
        }
      } else {
        const doc = await createMutation.mutateAsync(payload);
        if (submit && doc?.name) {
          await submitMutation.mutateAsync(doc.name);
        }
      }
      onSaved();
    } catch (err) {
      setError(err.readableMessage || err.response?.data?.message || 'Failed to save structure.');
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
            <h2 className="text-lg font-bold text-[var(--color-text)]">
              {editName ? 'Edit Fee Structure' : 'New Fee Structure'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Step {step} of 3</p>
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
          {[1, 2, 3].map(s => (
            <div key={s} className={`flex-1 h-1 transition-all ${step >= s ? 'bg-[var(--color-primary)]' : 'bg-gray-100'}`} />
          ))}
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100">{error}</div>}

          {/* Step 1: Basic Info */}
          {step === 1 && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                  Program <span className="text-red-500">*</span>
                </label>
                <select value={form.program} onChange={e => setField('program', e.target.value)}
                  className="input w-full text-sm">
                  <option value="">Select Program</option>
                  {sortedPrograms.map(p => (
                    <option key={p.name} value={p.name}>{p.program_name || p.name}</option>
                  ))}
                </select>
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
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Academic Term</label>
                  <input type="text" placeholder="e.g. Term 1" value={form.academic_term}
                    onChange={e => setField('academic_term', e.target.value)}
                    className="input w-full text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Student Category</label>
                  <input type="text" placeholder="e.g. General" value={form.student_category}
                    onChange={e => setField('student_category', e.target.value)}
                    className="input w-full text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                  Collection Frequency <span className="text-red-500">*</span>
                </label>
                <select value={form.collection_frequency} onChange={e => setField('collection_frequency', e.target.value)}
                  className="input w-full text-sm">
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                  <option value="Annually">Annually</option>
                  <option value="One-Time">One-Time</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">How often this fee is collected from students</p>
              </div>
            </>
          )}

          {/* Step 2: Fee Components */}
          {step === 2 && (
            <>
              <p className="text-sm text-gray-500">
                Define fee components for <span className="font-semibold text-[var(--color-text)]">{form.program}</span>
              </p>

              <div className="space-y-3">
                {form.components.map((comp, i) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-xl space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-400 mb-1">Fee Category</label>
                        {categories.length > 0 ? (
                          <select value={comp.fees_category}
                            onChange={e => setComponent(i, 'fees_category', e.target.value)}
                            className="input w-full text-sm">
                            <option value="">Select Category</option>
                            {categories.map(c => <option key={c.name} value={c.name}>{c.category_name || c.name}</option>)}
                          </select>
                        ) : (
                          <input type="text" placeholder="e.g. Tuition Fee"
                            value={comp.fees_category}
                            onChange={e => setComponent(i, 'fees_category', e.target.value)}
                            className="input w-full text-sm" />
                        )}
                      </div>
                      <div className="w-24">
                        <label className="block text-xs text-gray-400 mb-1">Amount</label>
                        <input type="number" placeholder="0" value={comp.amount}
                          onChange={e => setComponent(i, 'amount', e.target.value)}
                          className="input w-full text-sm" />
                      </div>
                      <div className="w-20">
                        <label className="block text-xs text-gray-400 mb-1">Discount</label>
                        <input type="number" placeholder="0" value={comp.discount}
                          onChange={e => setComponent(i, 'discount', e.target.value)}
                          className="input w-full text-sm" />
                      </div>
                      {form.components.length > 1 && (
                        <button onClick={() => removeComponent(i)} className="mt-4 text-red-400 hover:text-red-600 group">
                          <span className="w-4 h-4 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </span>
                        </button>
                      )}
                    </div>
                    <div className="flex justify-end text-xs text-gray-400">
                      Net: {INR((parseFloat(comp.amount) || 0) - (parseFloat(comp.discount) || 0))}
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={addComponent}
                className="flex items-center gap-1.5 text-sm text-[var(--color-primary)] hover:underline font-medium group">
                <span className="w-4 h-4 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </span>
                Add Component
              </button>

              <div className="flex items-center justify-between p-4 bg-[var(--color-primary)]/5 rounded-xl border border-[var(--color-primary)]/20">
                <span className="font-semibold text-[var(--color-text)]">Grand Total</span>
                <span className="text-xl font-bold text-[var(--color-primary)]">{INR(grandTotal)}</span>
              </div>
            </>
          )}

          {/* Step 3: Accounts */}
          {step === 3 && (
            <>
              <p className="text-sm text-gray-500">Configure accounting entries for this fee structure.</p>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Company</label>
                <input type="text" value={form.company}
                  onChange={e => setField('company', e.target.value)}
                  className="input w-full text-sm" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Receivable Account</label>
                <input type="text" value={form.receivable_account}
                  onChange={e => setField('receivable_account', e.target.value)}
                  className="input w-full text-sm" />
                <p className="text-xs text-gray-400 mt-1">Account where student fees receivables are recorded</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Cost Center</label>
                <input type="text" value={form.cost_center}
                  onChange={e => setField('cost_center', e.target.value)}
                  className="input w-full text-sm" />
              </div>

              {/* Late Fee Configuration */}
              <div className="border-t border-gray-100 pt-4 mt-4">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input type="checkbox" checked={form.enable_late_fee}
                      onChange={e => setField('enable_late_fee', e.target.checked)}
                      className="sr-only peer" />
                    <div className="w-10 h-5 bg-gray-200 rounded-full peer-checked:bg-[var(--color-primary)] transition-colors" />
                    <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm peer-checked:translate-x-5 transition-transform" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-[var(--color-text)]">Enable Late Fee</span>
                    <p className="text-xs text-gray-400">Apply penalty on overdue invoices</p>
                  </div>
                </label>
              </div>

              {form.enable_late_fee && (
                <div className="space-y-4 pl-1">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Late Fee Type</label>
                    <select value={form.late_fee_type} onChange={e => setField('late_fee_type', e.target.value)}
                      className="input w-full text-sm">
                      <option value="Fixed Amount">Fixed Amount</option>
                      <option value="Percentage of Outstanding">Percentage of Outstanding</option>
                    </select>
                  </div>

                  {form.late_fee_type === 'Fixed Amount' ? (
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Late Fee Amount</label>
                      <input type="number" min="0" placeholder="e.g. 500" value={form.late_fee_amount}
                        onChange={e => setField('late_fee_amount', e.target.value)}
                        className="input w-full text-sm" />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Late Fee Percent (%)</label>
                      <input type="number" min="0" max="100" step="0.5" placeholder="e.g. 5" value={form.late_fee_percent}
                        onChange={e => setField('late_fee_percent', e.target.value)}
                        className="input w-full text-sm" />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Grace Period (Days)</label>
                    <input type="number" min="0" placeholder="0" value={form.late_fee_grace_period_days}
                      onChange={e => setField('late_fee_grace_period_days', e.target.value)}
                      className="input w-full text-sm" />
                    <p className="text-xs text-gray-400 mt-1">Days after due date before penalty applies</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Late Fee Category</label>
                    <select value={form.late_fee_category} onChange={e => setField('late_fee_category', e.target.value)}
                      className="input w-full text-sm">
                      <option value="">Select category</option>
                      {categories.map(c => (
                        <option key={c.name} value={c.name}>{c.category_name || c.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">Fee Category for the late fee line item</p>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="rounded-2xl border border-gray-100 overflow-hidden mt-4">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Summary</p>
                </div>
                <div className="px-4 py-3 text-sm border-b border-gray-50 flex justify-between">
                  <span className="text-gray-400">Program</span>
                  <span className="font-medium text-[var(--color-text)]">{form.program}</span>
                </div>
                <div className="px-4 py-3 text-sm border-b border-gray-50 flex justify-between">
                  <span className="text-gray-400">Academic Year</span>
                  <span className="font-medium text-[var(--color-text)]">{form.academic_year}</span>
                </div>
                <div className="px-4 py-3 text-sm border-b border-gray-50 flex justify-between">
                  <span className="text-gray-400">Frequency</span>
                  <span className="font-medium text-[var(--color-text)]">{form.collection_frequency}</span>
                </div>
                <div className="px-4 py-3 text-sm border-b border-gray-50 flex justify-between">
                  <span className="text-gray-400">Components</span>
                  <span className="font-medium text-[var(--color-text)]">{form.components.length}</span>
                </div>
                <div className="px-4 py-3 text-sm flex justify-between">
                  <span className="text-gray-400">Total Amount</span>
                  <span className="font-bold text-[var(--color-primary)]">{INR(grandTotal)}</span>
                </div>
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
          <div className="flex items-center gap-2">
            {step === 3 && (
              <button onClick={() => handleSave(false)} disabled={saving || !canNext2}
                className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition disabled:opacity-50">
                Save as Draft
              </button>
            )}
            {step < 3 ? (
              <button onClick={() => setStep(s => s + 1)} disabled={step === 1 ? !canNext1 : !canNext2}
                className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">
                Next
              </button>
            ) : (
              <button onClick={() => handleSave(true)} disabled={saving || !canNext2}
                className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50 flex items-center gap-2 group">
                {saving ? (
                  <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</>
                ) : (editName ? 'Update & Submit' : 'Create & Submit')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
