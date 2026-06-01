import { ADMISSION_STAGES } from '../../api/frappe';

const stageColors = {
  INQUIRY: 'bg-blue-50 text-blue-700 border-blue-200',
  APPLICATION_SUBMITTED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  DOCUMENTS_PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  DOCUMENTS_VERIFIED: 'bg-teal-50 text-teal-700 border-teal-200',
  TEST_SCHEDULED: 'bg-purple-50 text-purple-700 border-purple-200',
  TEST_COMPLETED: 'bg-violet-50 text-violet-700 border-violet-200',
  INTERVIEW_SCHEDULED: 'bg-pink-50 text-pink-700 border-pink-200',
  INTERVIEW_COMPLETED: 'bg-rose-50 text-rose-700 border-rose-200',
  FEE_PENDING: 'bg-orange-50 text-orange-700 border-orange-200',
  ENROLLED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function AdmissionCard({ admission, onStatusChange, onSelect }) {
  const currentIdx = ADMISSION_STAGES.indexOf(admission.status);
  const docCount = admission.documents?.length || 0;
  const verifiedDocs = admission.documents?.filter(d => d.is_verified)?.length || 0;

  return (
    <div className="bg-white rounded-2xl border border-[#f1f5f9] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all duration-200">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <button onClick={() => onSelect?.(admission)}
            className="text-sm font-bold text-[#2D2A24] hover:text-[#2ED05D] transition-colors text-left cursor-pointer">
            {admission.applicant_name}
          </button>
          <p className="text-xs font-medium text-[#8A8680] mt-0.5">{admission.class_applied} · {admission.academic_year}</p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-[8px] border shrink-0 ${stageColors[admission.status] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
          {admission.status.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Stage progress */}
      <div className="flex items-center gap-0.5 mb-3">
        {ADMISSION_STAGES.slice(0, 10).map((s, i) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= currentIdx ? 'bg-[#2ED05D]' : 'bg-gray-100'}`} title={s.replace(/_/g, ' ')} />
        ))}
      </div>

      <div className="flex items-center justify-between text-xs font-medium text-[#8A8680]">
        <span>{admission.phone || '—'}</span>
        <span>{docCount > 0 ? `${verifiedDocs}/${docCount} docs` : 'No docs'}</span>
        <span>{admission.created_at ? new Date(admission.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</span>
      </div>
    </div>
  );
}
