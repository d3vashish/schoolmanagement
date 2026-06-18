import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { client } from '../../api/frappe';

const CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'EWS', 'Other'];
const RELIGIONS = ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

const emptyForm = {
  // Step 1 - Student
  applicant_name: '', date_of_birth: '', gender: '', phone: '', applicant_phone: '',
  applicant_email: '', address: '', aadhar_number: '', blood_group: '',
  category: '', caste: '', religion: '', nationality: 'Indian',
  // Step 2 - Academic
  class_id: '', academic_year_id: '', previous_school: '', previous_class: '', tc_number: '',
  // Step 3 - Father
  father_name: '', father_phone: '', father_email: '', father_occupation: '', father_aadhar: '',
  // Step 4 - Mother
  mother_name: '', mother_phone: '', mother_email: '', mother_occupation: '', mother_aadhar: '',
  // Step 5 - Guardian / remarks
  parent_name: '', parent_phone: '', parent_email: '', remarks: '',
};

const STEPS = [
  'Student Details',
  'Academic Info',
  "Father's Details",
  "Mother's Details",
  'Guardian & Remarks',
];

function Field({ label, required, children }) {
  return (
    <div>
      <label className="text-xs font-semibold text-[#8A8680] uppercase tracking-wide mb-1 block">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

const inp = "w-full py-2.5 px-4 text-sm font-medium border border-[#e2e8f0] rounded-xl focus:border-[#2ED05D] focus:outline-none focus:ring-2 focus:ring-[#2ED05D]/20 transition-all";

export default function AdmissionFormModal({ show, onClose, onSubmit }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});

  const { data: classes = [] } = useQuery({
    queryKey: ['academic-classes'],
    queryFn: async () => { const res = await client.get('/academic/classes'); return res.data; },
    enabled: show,
  });

  const { data: years = [] } = useQuery({
    queryKey: ['academic-years'],
    queryFn: async () => { const res = await client.get('/academic/years'); return res.data; },
    enabled: show,
  });

  if (!show) return null;

  const update = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: '' }));
  };

  const validate = () => {
    const e = {};
    if (step === 1) {
      if (!form.applicant_name.trim()) e.applicant_name = 'Required';
      if (!form.phone.trim()) e.phone = 'Required';
      if (!form.gender) e.gender = 'Required';
      if (!form.date_of_birth) e.date_of_birth = 'Required';
    }
    if (step === 2) {
      if (!form.class_id) e.class_id = 'Required';
      if (!form.academic_year_id) e.academic_year_id = 'Required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    if (step < 5) { setStep(s => s + 1); return; }
    const payload = {
      ...form,
      applicant_phone: form.phone || form.applicant_phone,
    };
    onSubmit(payload);
    setForm(emptyForm);
    setStep(1);
  };

  const close = () => { setForm(emptyForm); setStep(1); setErrors({}); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={close}>
      <div className="bg-white rounded-[28px] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-[0_24px_64px_rgba(0,0,0,0.12)]"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-xl font-extrabold text-[#2D2A24]">New Admission Application</h2>
              <p className="text-xs text-[#8A8680] mt-0.5">{STEPS[step - 1]}</p>
            </div>
            <button onClick={close} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* Progress bar */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className={`h-1.5 w-full rounded-full transition-all duration-300 ${i + 1 <= step ? 'bg-[#2ED05D]' : 'bg-gray-100'}`} />
                <span className={`text-[9px] font-bold hidden sm:block ${i + 1 === step ? 'text-[#2ED05D]' : 'text-gray-300'}`}>
                  {s.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── STEP 1: Student Details ── */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full Name" required>
                <input value={form.applicant_name} onChange={e => update('applicant_name', e.target.value)}
                  className={inp} placeholder="As per birth certificate" />
                {errors.applicant_name && <p className="text-red-500 text-xs mt-1">{errors.applicant_name}</p>}
              </Field>

              <Field label="Date of Birth" required>
                <input type="date" value={form.date_of_birth} onChange={e => update('date_of_birth', e.target.value)}
                  className={inp} />
                {errors.date_of_birth && <p className="text-red-500 text-xs mt-1">{errors.date_of_birth}</p>}
              </Field>

              <Field label="Gender" required>
                <select value={form.gender} onChange={e => update('gender', e.target.value)} className={inp}>
                  <option value="">Select</option>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
                {errors.gender && <p className="text-red-500 text-xs mt-1">{errors.gender}</p>}
              </Field>

              <Field label="Phone Number" required>
                <input value={form.phone} onChange={e => update('phone', e.target.value)}
                  className={inp} placeholder="Student/Parent contact" />
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
              </Field>

              <Field label="Email">
                <input type="email" value={form.applicant_email} onChange={e => update('applicant_email', e.target.value)}
                  className={inp} placeholder="student@email.com" />
              </Field>

              <Field label="Blood Group">
                <select value={form.blood_group} onChange={e => update('blood_group', e.target.value)} className={inp}>
                  <option value="">Select</option>
                  {BLOOD_GROUPS.map(b => <option key={b}>{b}</option>)}
                </select>
              </Field>

              <Field label="Aadhar Number">
                <input value={form.aadhar_number} onChange={e => update('aadhar_number', e.target.value)}
                  className={inp} placeholder="12-digit Aadhar" maxLength={12} />
              </Field>

              <Field label="Nationality">
                <input value={form.nationality} onChange={e => update('nationality', e.target.value)}
                  className={inp} />
              </Field>

              <Field label="Religion">
                <select value={form.religion} onChange={e => update('religion', e.target.value)} className={inp}>
                  <option value="">Select</option>
                  {RELIGIONS.map(r => <option key={r}>{r}</option>)}
                </select>
              </Field>

              <Field label="Category">
                <select value={form.category} onChange={e => update('category', e.target.value)} className={inp}>
                  <option value="">Select</option>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>

              <Field label="Caste">
                <input value={form.caste} onChange={e => update('caste', e.target.value)}
                  className={inp} placeholder="Optional" />
              </Field>

              <div className="col-span-2">
                <Field label="Address">
                  <textarea value={form.address} onChange={e => update('address', e.target.value)}
                    rows={2} className={inp + ' resize-none'} placeholder="Full residential address" />
                </Field>
              </div>
            </div>
          )}

          {/* ── STEP 2: Academic Info ── */}
          {step === 2 && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Class Applying For" required>
                <select value={form.class_id} onChange={e => update('class_id', e.target.value)} className={inp}>
                  <option value="">Select Class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {errors.class_id && <p className="text-red-500 text-xs mt-1">{errors.class_id}</p>}
              </Field>

              <Field label="Academic Year" required>
                <select value={form.academic_year_id} onChange={e => update('academic_year_id', e.target.value)} className={inp}>
                  <option value="">Select Year</option>
                  {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                </select>
                {errors.academic_year_id && <p className="text-red-500 text-xs mt-1">{errors.academic_year_id}</p>}
              </Field>

              <div className="col-span-2">
                <Field label="Previous School">
                  <input value={form.previous_school} onChange={e => update('previous_school', e.target.value)}
                    className={inp} placeholder="Name of previous school (if applicable)" />
                </Field>
              </div>

              <Field label="Previous Class">
                <input value={form.previous_class} onChange={e => update('previous_class', e.target.value)}
                  className={inp} placeholder="e.g. Class 5" />
              </Field>

              <Field label="TC Number">
                <input value={form.tc_number} onChange={e => update('tc_number', e.target.value)}
                  className={inp} placeholder="Transfer Certificate No." />
              </Field>
            </div>
          )}

          {/* ── STEP 3: Father's Details ── */}
          {step === 3 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 mb-1">
                <p className="text-xs text-[#8A8680]">Enter father's details. Leave blank if not applicable.</p>
              </div>
              <Field label="Father's Full Name">
                <input value={form.father_name} onChange={e => update('father_name', e.target.value)}
                  className={inp} />
              </Field>
              <Field label="Father's Phone">
                <input value={form.father_phone} onChange={e => update('father_phone', e.target.value)}
                  className={inp} placeholder="10-digit mobile" />
              </Field>
              <Field label="Father's Email">
                <input type="email" value={form.father_email} onChange={e => update('father_email', e.target.value)}
                  className={inp} />
              </Field>
              <Field label="Father's Occupation">
                <input value={form.father_occupation} onChange={e => update('father_occupation', e.target.value)}
                  className={inp} placeholder="e.g. Business, Service" />
              </Field>
              <Field label="Father's Aadhar Number">
                <input value={form.father_aadhar} onChange={e => update('father_aadhar', e.target.value)}
                  className={inp} placeholder="12-digit Aadhar" maxLength={12} />
              </Field>
            </div>
          )}

          {/* ── STEP 4: Mother's Details ── */}
          {step === 4 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 mb-1">
                <p className="text-xs text-[#8A8680]">Enter mother's details. Leave blank if not applicable.</p>
              </div>
              <Field label="Mother's Full Name">
                <input value={form.mother_name} onChange={e => update('mother_name', e.target.value)}
                  className={inp} />
              </Field>
              <Field label="Mother's Phone">
                <input value={form.mother_phone} onChange={e => update('mother_phone', e.target.value)}
                  className={inp} placeholder="10-digit mobile" />
              </Field>
              <Field label="Mother's Email">
                <input type="email" value={form.mother_email} onChange={e => update('mother_email', e.target.value)}
                  className={inp} />
              </Field>
              <Field label="Mother's Occupation">
                <input value={form.mother_occupation} onChange={e => update('mother_occupation', e.target.value)}
                  className={inp} placeholder="e.g. Homemaker, Teacher" />
              </Field>
              <Field label="Mother's Aadhar Number">
                <input value={form.mother_aadhar} onChange={e => update('mother_aadhar', e.target.value)}
                  className={inp} placeholder="12-digit Aadhar" maxLength={12} />
              </Field>
            </div>
          )}

          {/* ── STEP 5: Guardian & Remarks ── */}
          {step === 5 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 mb-1">
                <p className="text-xs text-[#8A8680]">Fill only if guardian is different from parents.</p>
              </div>
              <Field label="Guardian Name">
                <input value={form.parent_name} onChange={e => update('parent_name', e.target.value)}
                  className={inp} />
              </Field>
              <Field label="Guardian Phone">
                <input value={form.parent_phone} onChange={e => update('parent_phone', e.target.value)}
                  className={inp} />
              </Field>
              <Field label="Guardian Email">
                <input type="email" value={form.parent_email} onChange={e => update('parent_email', e.target.value)}
                  className={inp} />
              </Field>
              <div className="col-span-2">
                <Field label="Remarks / Notes">
                  <textarea value={form.remarks} onChange={e => update('remarks', e.target.value)}
                    rows={3} className={inp + ' resize-none'}
                    placeholder="Any special notes, medical conditions, or additional info..." />
                </Field>
              </div>

              {/* Summary */}
              <div className="col-span-2 bg-[#F7F9FC] rounded-2xl p-4 mt-2">
                <p className="text-xs font-bold text-[#8A8680] uppercase mb-3">Application Summary</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    { label: 'Name', value: form.applicant_name },
                    { label: 'DOB', value: form.date_of_birth },
                    { label: 'Gender', value: form.gender },
                    { label: 'Phone', value: form.phone },
                    { label: 'Class', value: classes.find(c => c.id === form.class_id)?.name },
                    { label: 'Year', value: years.find(y => y.id === form.academic_year_id)?.name },
                    { label: 'Father', value: form.father_name },
                    { label: 'Mother', value: form.mother_name },
                  ].map(f => f.value ? (
                    <div key={f.label} className="flex gap-2">
                      <span className="text-[#8A8680] text-xs w-16 shrink-0">{f.label}</span>
                      <span className="font-semibold text-[#2D2A24] text-xs truncate">{f.value}</span>
                    </div>
                  ) : null)}
                </div>
              </div>
            </div>
          )}

        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center">
          <button type="button" onClick={step > 1 ? () => setStep(s => s - 1) : close}
            className="px-4 py-2.5 rounded-xl text-sm font-bold bg-gray-100 text-[#475569] hover:bg-gray-200 transition-colors">
            {step > 1 ? '← Back' : 'Cancel'}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#8A8680]">Step {step} of {STEPS.length}</span>
            <button onClick={handleSubmit}
              className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[#2ED05D] text-white hover:bg-[#25B04E] transition-colors">
              {step < 5 ? 'Next →' : '✓ Submit Application'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}