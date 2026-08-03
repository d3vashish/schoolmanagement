import { useState } from 'react';
import { useAdmissionList, useCreateAdmission, useTransitionStatus, useUploadDocument, useVerifyDocument, useEnrollStudent } from '../hooks/useAdmissions';
import AdmissionFormModal from '../components/admissions/AdmissionFormModal';
import DocumentUpload from '../components/admissions/DocumentUpload';
import { getAllowedTransitions } from '../api/frappe';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '../api/frappe';

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  INQUIRY:               { label: 'Inquiry',               color: 'bg-gray-100 text-gray-600',        dot: 'bg-gray-400',    step: 1 },
  APPLICATION_SUBMITTED: { label: 'Application Submitted',  color: 'bg-blue-100 text-blue-700',        dot: 'bg-blue-500',    step: 2 },
  DOCUMENTS_PENDING:     { label: 'Documents Pending',      color: 'bg-amber-100 text-amber-700',      dot: 'bg-amber-500',   step: 3 },
  DOCUMENTS_VERIFIED:    { label: 'Documents Verified',     color: 'bg-cyan-100 text-cyan-700',        dot: 'bg-cyan-500',    step: 4 },
  FEE_PENDING:           { label: 'Fee Pending',            color: 'bg-orange-100 text-orange-700',    dot: 'bg-orange-500',  step: 5 },
  ENROLLED:              { label: 'Enrolled',               color: 'bg-emerald-100 text-emerald-700',  dot: 'bg-emerald-500', step: 6 },
};

const PIPELINE_STAGES = ['INQUIRY', 'APPLICATION_SUBMITTED', 'DOCUMENTS_PENDING', 'DOCUMENTS_VERIFIED', 'FEE_PENDING', 'ENROLLED'];
const FILTER_TABS = [{ key: '', label: 'All' }, ...PIPELINE_STAGES.map(s => ({ key: s, label: STATUS_CONFIG[s]?.label || s }))];

// ── StatusBadge ────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ── PipelineProgress ───────────────────────────────────────────────────────────
function PipelineProgress({ status }) {
  const currentStep = STATUS_CONFIG[status]?.step || 1;
  return (
    <div className="flex items-center gap-1">
      {PIPELINE_STAGES.map((stage, i) => {
        const step = i + 1;
        const done = step < currentStep;
        const active = step === currentStep;
        return (
          <div key={stage} className="flex items-center gap-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all
              ${done ? 'bg-emerald-500 text-white' : active ? 'bg-[#2ED05D] text-white ring-2 ring-[#2ED05D]/30' : 'bg-gray-100 text-gray-400'}`}>
              {done ? '✓' : step}
            </div>
            {i < PIPELINE_STAGES.length - 1 && (
              <div className={`h-0.5 w-4 rounded-full ${done ? 'bg-emerald-500' : 'bg-gray-100'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── EnrollButton ───────────────────────────────────────────────────────────────
function EnrollButton({ admissionId, onSuccess }) {
  const [showPicker, setShowPicker] = useState(false);
  const [sectionId, setSectionId] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollResult, setEnrollResult] = useState(null);
  const queryClient = useQueryClient();

  const { data: sections = [] } = useQuery({
    queryKey: ['academic-sections'],
    queryFn: async () => {
      const res = await client.get('/academic/sections');
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    },
    enabled: showPicker,
  });

  const handleEnroll = async () => {
    if (!sectionId) { alert('Please select a section'); return; }
    setEnrolling(true);
    try {
      const res = await client.post(`/admissions/${admissionId}/enroll?section_id=${sectionId}`);
      setEnrollResult(res.data);
      setShowPicker(false);
      setSectionId('');
      queryClient.invalidateQueries({ queryKey: ['admissions'] });
      queryClient.invalidateQueries({ queryKey: ['Student', 'students'] });
      onSuccess();
    } catch (e) {
      alert(e.response?.data?.detail || 'Enrollment failed');
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <>
      <button onClick={() => setShowPicker(true)}
        className="px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
        ✓ Enroll Student
      </button>

      {showPicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowPicker(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#2D2A24] mb-1">Enroll Student</h3>
            <p className="text-xs text-gray-400 mb-4">Select the section to assign this student to.</p>
            <select value={sectionId} onChange={e => setSectionId(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm mb-4 focus:outline-none focus:border-[#2ED05D] focus:ring-2 focus:ring-[#2ED05D]/20">
              <option value="">Select Section</option>
              {sections.map(s => (
                <option key={s.id} value={s.id}>{s.program} — {s.name}</option>
              ))}
            </select>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowPicker(false); setSectionId(''); }}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                Cancel
              </button>
              <button onClick={handleEnroll} disabled={enrolling || !sectionId}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2">
                {enrolling && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {enrolling ? 'Enrolling...' : 'Confirm Enroll'}
              </button>
            </div>
          </div>
        </div>
      )}

      {enrollResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setEnrollResult(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[#2D2A24] mb-1 text-center">Student Enrolled!</h3>
            <p className="text-xs text-gray-400 mb-4 text-center">Share these credentials with the student.</p>
            <div className="bg-gray-50 rounded-xl p-4 space-y-3 mb-4">
              <div>
                <p className="text-xs text-gray-500 font-medium">Admission Number</p>
                <p className="text-sm font-bold text-[#2D2A24]">{enrollResult.admission_number}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Student ID</p>
                <p className="text-sm font-bold text-[#2D2A24]">{enrollResult.student_id}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Temporary Password</p>
                <p className="text-sm font-bold text-emerald-600 font-mono bg-emerald-50 px-3 py-1.5 rounded-lg inline-block">{enrollResult.temp_password}</p>
              </div>
            </div>
            <button onClick={() => setEnrollResult(null)}
              className="w-full px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── AdmissionDetailPanel ───────────────────────────────────────────────────────
function AdmissionDetailPanel({ admission, onClose, onTransition, onVerifyDoc, onUploadDoc, onEnroll, transitioning, uploading, verifying }) {
  const allowed = getAllowedTransitions(admission.status);

  const sections = [
    {
      title: 'Student Information',
      items: [
        { label: 'Full Name', value: admission.applicant_name },
        { label: 'Date of Birth', value: admission.date_of_birth ? new Date(admission.date_of_birth).toLocaleDateString('en-IN') : null },
        { label: 'Gender', value: admission.gender },
        { label: 'Phone', value: admission.phone || admission.applicant_phone },
        { label: 'Email', value: admission.applicant_email },
        { label: 'Blood Group', value: admission.blood_group },
        { label: 'Aadhar Number', value: admission.aadhar_number },
        { label: 'Category', value: admission.category },
        { label: 'Caste', value: admission.caste },
        { label: 'Religion', value: admission.religion },
        { label: 'Nationality', value: admission.nationality },
        { label: 'Address', value: admission.address, full: true },
      ],
    },
    {
      title: "Father's Details",
      items: [
        { label: "Father's Name", value: admission.father_name },
        { label: "Father's Phone", value: admission.father_phone },
        { label: "Father's Email", value: admission.father_email },
        { label: 'Occupation', value: admission.father_occupation },
        { label: "Father's Aadhar", value: admission.father_aadhar },
      ],
    },
    {
      title: "Mother's Details",
      items: [
        { label: "Mother's Name", value: admission.mother_name },
        { label: "Mother's Phone", value: admission.mother_phone },
        { label: "Mother's Email", value: admission.mother_email },
        { label: 'Occupation', value: admission.mother_occupation },
        { label: "Mother's Aadhar", value: admission.mother_aadhar },
      ],
    },
    {
      title: 'Academic Details',
      items: [
        { label: 'Previous School', value: admission.previous_school, full: true },
        { label: 'Previous Class', value: admission.previous_class },
        { label: 'TC Number', value: admission.tc_number },
        { label: 'Remarks', value: admission.remarks, full: true },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl h-full overflow-y-auto shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-xl font-extrabold text-[#2D2A24]">{admission.applicant_name}</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                Applied on {admission.created_at
                  ? new Date(admission.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
                  : '—'}
              </p>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <StatusBadge status={admission.status} />
            <PipelineProgress status={admission.status} />
          </div>
        </div>

        {/* Actions */}
        {(allowed.length > 0 || admission.status === 'FEE_PENDING') && (
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Move Application</p>
            <div className="flex flex-wrap gap-2">
              {allowed.map(s => (
                <button key={s} onClick={() => onTransition(s)} disabled={transitioning}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-[#2ED05D] text-white hover:bg-[#25B04E] disabled:opacity-50 transition-colors flex items-center gap-1.5">
                  {transitioning && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  → {STATUS_CONFIG[s]?.label || s}
                </button>
              ))}
              {admission.status === 'FEE_PENDING' && (
                <EnrollButton admissionId={admission.id} onSuccess={onEnroll} />
              )}
            </div>
          </div>
        )}

        {/* Detail sections */}
        <div className="flex-1 px-6 py-5 space-y-6">
          {sections.map(sec => {
            const visible = sec.items.filter(i => i.value);
            if (visible.length === 0) return null;
            return (
              <div key={sec.title}>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{sec.title}</h3>
                <div className="grid grid-cols-2 gap-3">
                  {visible.map(item => (
                    <div key={item.label}
                      className={`bg-gray-50 rounded-xl px-4 py-3 ${item.full ? 'col-span-2' : ''}`}>
                      <p className="text-xs text-gray-400 mb-0.5">{item.label}</p>
                      <p className="text-sm font-semibold text-[#2D2A24]">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Documents */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Documents</h3>
            {(admission.documents || []).length === 0 ? (
              <p className="text-sm text-gray-400 italic mb-4">No documents uploaded yet.</p>
            ) : (
              <div className="space-y-2 mb-4">
                {(admission.documents || []).map(d => (
                  <div key={d.id}
                    className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#2D2A24]">{d.document_type || d.doc_type || 'Document'}</p>
                        <span className={`text-xs font-semibold ${d.is_verified || d.status === 'VERIFIED' ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {d.is_verified || d.status === 'VERIFIED' ? '✓ Verified' : '⏳ Pending'}
                        </span>
                      </div>
                    </div>
                    {!(d.is_verified || d.status === 'VERIFIED') && (
                      <button onClick={() => onVerifyDoc(d.id)} disabled={verifying}
                        className="px-3 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50">
                        Verify
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <DocumentUpload onUpload={(file, dt) => onUploadDoc(file, dt)} uploading={uploading} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function Admissions() {
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');

  const { data: admissions = [], isLoading } = useAdmissionList(statusFilter ? { status: statusFilter } : {});
  const createAdmission = useCreateAdmission();
  const transitionStatus = useTransitionStatus();
  const uploadDoc = useUploadDocument();
  const verifyDoc = useVerifyDocument();

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const detail = selected ? (admissions.find(a => a.id === selected.id) || selected) : null;

  const stats = PIPELINE_STAGES.map(s => ({
    status: s,
    count: admissions.filter(a => a.status === s).length,
    ...STATUS_CONFIG[s],
  }));

  const filtered = admissions.filter(a =>
    !search ||
    a.applicant_name?.toLowerCase().includes(search.toLowerCase()) ||
    a.phone?.includes(search) ||
    a.applicant_phone?.includes(search) ||
    a.father_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-16">

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl text-sm font-semibold bg-[#2D2A24] text-white shadow-xl">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="eyebrow">Enrollment</div>
          <h1 className="text-3xl font-extrabold text-[#2D2A24] -mt-1">Admissions</h1>
          <p className="text-[#8A8680] mt-1 text-sm">{admissions.length} total applications</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[#2ED05D] text-white hover:bg-[#25B04E] transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New Application
        </button>
      </div>

      {/* Pipeline stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {stats.map(s => (
          <button key={s.status}
            onClick={() => setStatusFilter(statusFilter === s.status ? '' : s.status)}
            className={`rounded-2xl p-3 text-left transition-all border-2 bg-white ${
              statusFilter === s.status ? 'border-[#2ED05D] shadow-md' : 'border-transparent hover:border-gray-200'
            }`}>
            <div className={`w-2 h-2 rounded-full ${s.dot} mb-2`} />
            <p className="text-xl font-extrabold text-[#2D2A24]">{s.count}</p>
            <p className="text-[10px] font-semibold text-gray-400 leading-tight mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Search + filter tabs */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="Search by name, phone..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#2ED05D] focus:ring-2 focus:ring-[#2ED05D]/20" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTER_TABS.map(t => (
            <button key={t.key} onClick={() => setStatusFilter(t.key)}
              className={`text-xs font-bold px-3 py-1.5 rounded-[10px] transition-colors ${
                statusFilter === t.key ? 'bg-[#2D2A24] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <span className="w-8 h-8 border-2 border-[#2ED05D] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="font-semibold text-gray-400">No applications found</p>
            <p className="text-sm text-gray-300 mt-1">Click "New Application" to add one</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['#', 'Student', 'Parent', 'Contact', 'Progress', 'Status', 'Date', 'Action'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((a, idx) => (
                  <tr key={a.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-5 py-4 text-xs text-gray-300 font-mono">{idx + 1}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#2ED05D]/10 flex items-center justify-center text-[#2ED05D] font-bold text-sm shrink-0">
                          {(a.applicant_name || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <button onClick={() => setSelected(a)}
                            className="font-semibold text-[#2D2A24] hover:text-[#2ED05D] transition-colors text-left">
                            {a.applicant_name}
                          </button>
                          {a.gender && <p className="text-xs text-gray-400">{a.gender}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-gray-700">{a.father_name || a.parent_name || '—'}</p>
                      {a.mother_name && <p className="text-xs text-gray-400">{a.mother_name}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-gray-700">{a.phone || a.applicant_phone || '—'}</p>
                      {a.applicant_email && <p className="text-xs text-gray-400 truncate max-w-[140px]">{a.applicant_email}</p>}
                    </td>
                    <td className="px-5 py-4"><PipelineProgress status={a.status} /></td>
                    <td className="px-5 py-4"><StatusBadge status={a.status} /></td>
                    <td className="px-5 py-4 text-xs text-gray-400">
                      {a.created_at ? new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setSelected(a)}
                          className="px-3 py-1.5 text-xs font-bold text-[#2ED05D] bg-[#2ED05D]/10 rounded-lg hover:bg-[#2ED05D]/20 transition-colors">
                          View
                        </button>
                        {getAllowedTransitions(a.status).length > 0 && (
                          <button
                            onClick={() => {
                              transitionStatus.mutate({ id: a.id, status: getAllowedTransitions(a.status)[0] });
                              showToast('Status updated!');
                            }}
                            disabled={transitionStatus.isPending}
                            className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50">
                            Advance →
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {detail && (
        <AdmissionDetailPanel
          admission={detail}
          onClose={() => setSelected(null)}
          onTransition={(s) => {
            transitionStatus.mutate({ id: detail.id, status: s });
            showToast(`Moved to ${STATUS_CONFIG[s]?.label || s}`);
          }}
          onVerifyDoc={(docId) => {
            verifyDoc.mutate({ admissionId: detail.id, docId });
            showToast('Document verified!');
          }}
          onUploadDoc={(file, dt) => {
            uploadDoc.mutate({ id: detail.id, file, docType: dt }, {
              onSuccess: () => showToast('Document uploaded!'),
            });
          }}
          onEnroll={() => {
            showToast('Student enrolled successfully!');
            setSelected(null);
          }}
          transitioning={transitionStatus.isPending}
          uploading={uploadDoc.isPending}
          verifying={verifyDoc.isPending}
        />
      )}

      {/* Create modal */}
      <AdmissionFormModal
        show={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={(data) => {
          createAdmission.mutate(data, {
            onSuccess: () => { setShowCreate(false); showToast('Application created!'); },
            onError: (err) => { showToast(err.response?.data?.detail || 'Failed to create application'); },
          });
        }}
      />
    </div>
  );
}
