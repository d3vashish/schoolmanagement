import { useState } from 'react';

export default function AdmissionFormModal({ show, onClose, onSubmit }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    applicant_name: '', date_of_birth: '', gender: '', phone: '', email: '', address: '',
    class_applied: '', academic_year: '', previous_school: '',
    parent_name: '', parent_phone: '', parent_email: '',
  });

  if (!show) return null;

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (step < 3) { setStep(s => s + 1); return; }
    onSubmit(form);
    setForm({ applicant_name: '', date_of_birth: '', gender: '', phone: '', email: '', address: '',
      class_applied: '', academic_year: '', previous_school: '',
      parent_name: '', parent_phone: '', parent_email: '' });
    setStep(1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-[28px] p-6 w-full max-w-xl shadow-[0_16px_48px_rgba(0,0,0,0.1)]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-1">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? 'bg-[#2ED05D]' : 'bg-gray-100'}`} />
          ))}
        </div>
        <p className="text-xs font-semibold text-[#8A8680] mb-4">Step {step} of 3</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {step === 1 && (
            <>
              <h3 className="text-lg font-extrabold text-[#2D2A24]">Applicant Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-[#8A8680] uppercase tracking-wide mb-1 block">Full Name</label>
                  <input value={form.applicant_name} onChange={e => update('applicant_name', e.target.value)} required
                    className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl focus:border-[#2ED05D]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#8A8680] uppercase tracking-wide mb-1 block">Date of Birth</label>
                  <input type="date" value={form.date_of_birth} onChange={e => update('date_of_birth', e.target.value)}
                    className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl focus:border-[#2ED05D]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#8A8680] uppercase tracking-wide mb-1 block">Gender</label>
                  <select value={form.gender} onChange={e => update('gender', e.target.value)}
                    className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl focus:border-[#2ED05D]">
                    <option value="">Select</option><option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#8A8680] uppercase tracking-wide mb-1 block">Phone</label>
                  <input value={form.phone} onChange={e => update('phone', e.target.value)}
                    className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl focus:border-[#2ED05D]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#8A8680] uppercase tracking-wide mb-1 block">Email</label>
                  <input type="email" value={form.email} onChange={e => update('email', e.target.value)}
                    className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl focus:border-[#2ED05D]" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-[#8A8680] uppercase tracking-wide mb-1 block">Address</label>
                  <textarea value={form.address} onChange={e => update('address', e.target.value)} rows={2}
                    className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl focus:border-[#2ED05D] resize-none" />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h3 className="text-lg font-extrabold text-[#2D2A24]">Academic Info</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-[#8A8680] uppercase tracking-wide mb-1 block">Class Applying For</label>
                  <select value={form.class_applied} onChange={e => update('class_applied', e.target.value)}
                    className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl focus:border-[#2ED05D]">
                    <option value="">Select</option>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={`Class ${i + 1}`}>Class {i + 1}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#8A8680] uppercase tracking-wide mb-1 block">Academic Year</label>
                  <input value={form.academic_year} onChange={e => update('academic_year', e.target.value)}
                    className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl focus:border-[#2ED05D]" placeholder="e.g. 2025-26" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-[#8A8680] uppercase tracking-wide mb-1 block">Previous School</label>
                  <input value={form.previous_school} onChange={e => update('previous_school', e.target.value)}
                    className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl focus:border-[#2ED05D]" placeholder="(if applicable)" />
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h3 className="text-lg font-extrabold text-[#2D2A24]">Parent / Guardian Info</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-[#8A8680] uppercase tracking-wide mb-1 block">Parent Name</label>
                  <input value={form.parent_name} onChange={e => update('parent_name', e.target.value)}
                    className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl focus:border-[#2ED05D]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#8A8680] uppercase tracking-wide mb-1 block">Parent Phone</label>
                  <input value={form.parent_phone} onChange={e => update('parent_phone', e.target.value)}
                    className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl focus:border-[#2ED05D]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#8A8680] uppercase tracking-wide mb-1 block">Parent Email</label>
                  <input type="email" value={form.parent_email} onChange={e => update('parent_email', e.target.value)}
                    className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl focus:border-[#2ED05D]" />
                </div>
              </div>
            </>
          )}

          <div className="flex justify-between pt-2">
            <button type="button" onClick={step > 1 ? () => setStep(s => s - 1) : onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-bold bg-gray-100 text-[#475569] hover:bg-gray-200 transition-colors cursor-pointer">
              {step > 1 ? 'Back' : 'Cancel'}
            </button>
            <button type="submit" className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[#2ED05D] text-white hover:bg-[#25B04E] transition-colors cursor-pointer">
              {step < 3 ? 'Next' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
