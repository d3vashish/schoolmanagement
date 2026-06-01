import { useState } from 'react';
import { useAdmissionList, useCreateAdmission, useTransitionStatus, useUploadDocument, useVerifyDocument, useEnrollStudent } from '../hooks/useAdmissions';
import AdmissionCard from '../components/admissions/AdmissionCard';
import AdmissionFormModal from '../components/admissions/AdmissionFormModal';
import DocumentUpload from '../components/admissions/DocumentUpload';
import StatusTransition from '../components/admissions/StatusTransition';
import { ADMISSION_STAGES } from '../api/frappe';

export default function Admissions() {
  const [view, setView] = useState('kanban');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState('');

  const { data: admissions = [], isLoading } = useAdmissionList(statusFilter ? { status: statusFilter } : {});
  const createAdmission = useCreateAdmission();
  const transitionStatus = useTransitionStatus();
  const uploadDoc = useUploadDocument();
  const verifyDoc = useVerifyDocument();
  const enrollStudent = useEnrollStudent();

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const grouped = {};
  if (view === 'kanban') {
    ADMISSION_STAGES.forEach(s => { grouped[s] = []; });
    admissions.forEach(a => { if (grouped[a.status]) grouped[a.status].push(a); });
  }

  const detail = selected ? (admissions.find(a => a.id === selected.id) || selected) : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl text-sm font-semibold bg-[#2D2A24] text-white shadow-[0_8px_32px_rgba(0,0,0,0.2)] animate-fade-in-up">
          {toast}
        </div>
      )}

      <div className="flex items-end justify-between">
        <div>
          <div className="eyebrow">Enrollment</div>
          <h1 className="text-[2rem] sm:text-[2.5rem] font-extrabold text-[#2D2A24] tracking-tight leading-[1.1] -mt-1">Admissions</h1>
          <p className="text-[#8A8680] mt-2 font-medium text-sm">{admissions.length} applications</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-gray-200">
            <button onClick={() => setView('kanban')}
              className={`px-3 py-2 text-xs font-bold transition-colors ${view === 'kanban' ? 'bg-[#2ED05D] text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>Kanban</button>
            <button onClick={() => setView('list')}
              className={`px-3 py-2 text-xs font-bold transition-colors ${view === 'list' ? 'bg-[#2ED05D] text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>List</button>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="px-4 py-2.5 rounded-xl text-sm font-bold bg-[#2ED05D] text-white hover:bg-[#25B04E] transition-colors cursor-pointer">+ New Application</button>
        </div>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setStatusFilter('')}
          className={`text-xs font-bold px-3 py-1.5 rounded-[10px] transition-colors ${!statusFilter ? 'bg-[#2D2A24] text-white' : 'bg-gray-100 text-[#475569] hover:bg-gray-200'}`}>All</button>
        {ADMISSION_STAGES.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`text-xs font-bold px-3 py-1.5 rounded-[10px] transition-colors ${statusFilter === s ? 'bg-[#2D2A24] text-white' : 'bg-gray-100 text-[#475569] hover:bg-gray-200'}`}>
            {s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {detail && !view && null}

      {view === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ scrollbarWidth: 'thin' }}>
          {ADMISSION_STAGES.map(stage => (
            <div key={stage} className="min-w-[260px] w-[260px] shrink-0">
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-xs font-bold text-[#8A8680] uppercase tracking-wide">{stage.replace(/_/g, ' ')}</h3>
                <span className="text-xs font-bold text-[#B0ABA4]">{(grouped[stage] || []).length}</span>
              </div>
              <div className="space-y-3 min-h-[200px]">
                {(grouped[stage] || []).map(a => (
                  <AdmissionCard key={a.id} admission={a} onSelect={setSelected} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-[28px] border border-[#f1f5f9] overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20"><span className="w-8 h-8 border-2 border-[#2ED05D] border-t-transparent rounded-full animate-spin" /></div>
          ) : admissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-sm font-medium text-[#8A8680]">No admissions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F7F9FC] border-b border-[#f1f5f9]">
                    <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">Name</th>
                    <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">Class</th>
                    <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">Parent</th>
                    <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">Phone</th>
                    <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">Status</th>
                    <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">Date</th>
                    <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {admissions.map(a => (
                    <tr key={a.id} className="hover:bg-[#F7F9FC]/50 transition-colors">
                      <td className="px-5 py-4">
                        <button onClick={() => setSelected(a)} className="font-semibold text-[#2D2A24] hover:text-[#2ED05D] transition-colors cursor-pointer">{a.applicant_name}</button>
                      </td>
                      <td className="px-5 py-4 text-[#8A8680]">{a.class_applied}</td>
                      <td className="px-5 py-4 text-[#8A8680]">{a.parent_name || '—'}</td>
                      <td className="px-5 py-4 text-[#8A8680]">{a.phone || '—'}</td>
                      <td className="px-5 py-4">
                        <span className="text-[10px] font-bold px-2 py-1 rounded-[8px] bg-blue-50 text-blue-700">{a.status.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="px-5 py-4 text-[#8A8680] text-xs">{a.created_at ? new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</td>
                      <td className="px-5 py-4">
                        <StatusTransition currentStatus={a.status}
                          onTransition={s => { transitionStatus.mutate({ id: a.id, status: s }); showToast(`Moved to ${s.replace(/_/g, ' ')}`); }}
                          loading={transitionStatus.isPending} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Selected detail panel (slide-up) */}
      {detail && (
        <div className="bg-white rounded-[28px] border border-[#f1f5f9] p-6 animate-in">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl font-extrabold text-[#2D2A24]">{detail.applicant_name}</h2>
                <span className="text-[10px] font-bold px-2 py-1 rounded-[8px] bg-blue-50 text-blue-700">{detail.status.replace(/_/g, ' ')}</span>
              </div>
              <p className="text-sm text-[#8A8680]">{detail.class_applied} · {detail.academic_year}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-[#8A8680] hover:text-[#2D2A24] transition-colors cursor-pointer">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Phone', value: detail.phone },
              { label: 'Email', value: detail.email },
              { label: 'Parent', value: detail.parent_name },
              { label: 'Parent Phone', value: detail.parent_phone },
            ].map(f => (
              <div key={f.label} className="bg-[#F7F9FC] rounded-2xl px-4 py-3">
                <p className="text-xs font-semibold text-[#8A8680] uppercase">{f.label}</p>
                <p className="text-sm font-bold text-[#2D2A24] mt-1">{f.value || '—'}</p>
              </div>
            ))}
          </div>

          {/* Status transition */}
          <div className="flex items-center gap-4 mb-6">
            <StatusTransition currentStatus={detail.status}
              onTransition={s => { transitionStatus.mutate({ id: detail.id, status: s }); showToast(`Moved to ${s.replace(/_/g, ' ')}`); }}
              loading={transitionStatus.isPending} />
            {detail.status === 'FEE_PENDING' && (
              <button onClick={() => { enrollStudent.mutate(detail.id); showToast('Enrolled!'); }}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer">
                Enroll Student
              </button>
            )}
          </div>

          {/* Documents */}
          <div>
            <h3 className="text-sm font-bold text-[#2D2A24] mb-3">Documents ({detail.documents?.length || 0})</h3>
            <div className="space-y-2 mb-4">
              {(detail.documents || []).map(d => (
                <div key={d.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#F7F9FC]">
                  <div className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-[#8A8680]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-sm font-medium text-[#2D2A24]">{d.document_type || 'Document'}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${d.is_verified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {d.is_verified ? 'Verified' : 'Pending'}
                    </span>
                  </div>
                  {!d.is_verified && (
                    <button onClick={() => { verifyDoc.mutate({ admissionId: detail.id, docId: d.id }); showToast('Document verified!'); }}
                      className="text-xs font-bold text-[#2ED05D] hover:text-[#25B04E] transition-colors cursor-pointer">Verify</button>
                  )}
                </div>
              ))}
            </div>
            <DocumentUpload onUpload={(file, docType) => {
              uploadDoc.mutate({ id: detail.id, file, docType }, { onSuccess: () => showToast('Document uploaded!') });
            }} uploading={uploadDoc.isPending} />
          </div>
        </div>
      )}

      <AdmissionFormModal show={showCreate} onClose={() => setShowCreate(false)}
        onSubmit={(data) => { createAdmission.mutate(data, { onSuccess: () => { setShowCreate(false); showToast('Application created!'); } }); }} />
    </div>
  );
}
