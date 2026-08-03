import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { client } from '../api/frappe';
import { useAcademicYear } from '../context/AcademicYearContext';
import { useSubjects } from '../hooks/useSubjects';
import {
  useExams, useCreateExam, useExamSubjects, useAddExamSubject,
  useExamResults, useBulkSaveExamResults, useExamAggregates,
  useTransitionExam, useComputeExam, useTriggerReportCards,
} from '../hooks/useExams';

const STAGES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'PUBLISHED'];
const STAGE_LABEL = { DRAFT: 'Draft', SUBMITTED: 'Submitted', APPROVED: 'Approved', PUBLISHED: 'Published' };
const badgeClass = (s) => s === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700'
  : s === 'APPROVED' ? 'bg-blue-100 text-blue-700'
  : s === 'SUBMITTED' ? 'bg-indigo-100 text-indigo-700'
  : 'bg-amber-100 text-amber-700';

export default function ExamManagement() {
  const [selectedExam, setSelectedExam] = useState(null);
  const [toast, setToast] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showSubject, setShowSubject] = useState(false);
  const [examForm, setExamForm] = useState({ name: '', academic_year_id: '', class_id: '', section_id: '', start_date: '', end_date: '' });
  const [subjectForm, setSubjectForm] = useState({ subject_id: '', max_marks: 100, date: '' });
  const [marksEdit, setMarksEdit] = useState({});

  const { selectedYear } = useAcademicYear();
  const { data: exams = [], isLoading } = useExams();
  const { data: allSubjects = [] } = useSubjects();
  const { data: classes = [] } = useQuery({ queryKey: ['exam', 'classes'], queryFn: async () => (await client.get('/academic/classes')).data || [] });
  const { data: sections = [] } = useQuery({ queryKey: ['exam', 'sections'], queryFn: async () => (await client.get('/academic/sections')).data || [] });
  const { data: years = [] } = useQuery({ queryKey: ['exam', 'years'], queryFn: async () => (await client.get('/academic/years')).data || [] });

  const createExam = useCreateExam();
  const addSubject = useAddExamSubject();
  const bulkSave = useBulkSaveExamResults();
  const transition = useTransitionExam();
  const compute = useComputeExam();
  const triggerCards = useTriggerReportCards();

  const { data: subjects = [] } = useExamSubjects(selectedExam?.id);
  const { data: results = [] } = useExamResults(selectedExam?.id);
  const { data: aggregates = [] } = useExamAggregates(selectedExam?.id);
  const { data: examStudents = [] } = useQuery({
    queryKey: ['exam', 'students', selectedExam?.id, selectedExam?.section_id, selectedExam?.class_id, selectedExam?.academic_year_id, sections.length],
    queryFn: async () => {
      const yr = selectedExam.academic_year_id;
      const fetchSection = async (sid) => {
        const params = { section_id: sid, page: 1, per_page: 200 };
        if (yr) params.academic_year_id = yr;
        return (await client.get('/academic/students', { params })).data?.data || [];
      };
      // Exam tied to one section → just that section.
      if (selectedExam.section_id) return fetchSection(selectedExam.section_id);
      // "All sections" exam → gather every section of the exam's class.
      const secIds = sections.filter(s => s.class_id === selectedExam.class_id).map(s => s.id);
      const lists = await Promise.all(secIds.map(fetchSection));
      const seen = new Set();
      const out = [];
      for (const list of lists) for (const stu of list) if (!seen.has(stu.id)) { seen.add(stu.id); out.push(stu); }
      return out;
    },
    enabled: !!selectedExam?.id && (!!selectedExam?.section_id || (!!selectedExam?.class_id && sections.length > 0)),
  });

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 3000); };
  const fmtErr = (err) => {
    const d = err?.response?.data?.detail;
    if (!d) return 'Request failed';
    if (typeof d === 'string') return d;
    if (Array.isArray(d)) return d.map(e => e?.msg || '').filter(Boolean).join('; ') || 'Validation error';
    return 'Request failed';
  };
  const classNameById = (id) => classes.find(c => c.id === id)?.name || '';
  const sectionNameById = (id) => sections.find(s => s.id === id)?.name || 'All sections';
  const studentName = (id) => {
    const s = examStudents.find(x => x.id === id);
    if (s) return `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.email || id;
    const r = results.find(x => x.student_id === id);
    return r?.student_name || id;
  };

  const status = selectedExam?.status || 'DRAFT';
  const stageIdx = STAGES.indexOf(status);

  const doCreate = () => createExam.mutate(examForm, {
    onSuccess: (created) => {
      setShowCreate(false);
      setExamForm({ name: '', academic_year_id: '', class_id: '', section_id: '', start_date: '', end_date: '' });
      showToast('Exam created!');
      if (created?.id) setSelectedExam(created);
    },
    onError: (err) => showToast(fmtErr(err)),
  });
  const doAddSubject = () => addSubject.mutate({ examId: selectedExam.id, data: subjectForm }, {
    onSuccess: () => { setShowSubject(false); setSubjectForm({ subject_id: '', max_marks: 100, date: '' }); showToast('Subject added!'); },
    onError: (err) => showToast(fmtErr(err)),
  });
  const doSaveMarks = () => {
    const entries = Object.values(marksEdit);
    if (entries.length === 0) { showToast('Type some marks first'); return; }
    bulkSave.mutate({ examId: selectedExam.id, results: entries }, {
      onSuccess: () => { setMarksEdit({}); showToast(`${entries.length} marks saved!`); },
      onError: (err) => showToast(fmtErr(err)),
    });
  };
  const doTransition = (action, nextStatus) => transition.mutate({ id: selectedExam.id, action }, {
    onSuccess: () => { setSelectedExam(e => ({ ...e, status: nextStatus })); showToast(`Moved to ${STAGE_LABEL[nextStatus]}`); },
    onError: (err) => showToast(fmtErr(err)),
  });
  const doCompute = () => compute.mutate(selectedExam.id, { onSuccess: () => showToast('Results computed!'), onError: (err) => showToast(fmtErr(err)) });
  const doReportCards = () => triggerCards.mutate(selectedExam.id, { onSuccess: () => showToast('Report card generation started'), onError: (err) => showToast(fmtErr(err)) });
  const downloadReportCard = async (studentId) => {
    try {
      const res = await client.get(`/exams/${selectedExam.id}/report-cards/${studentId}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `report-card.pdf`; a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) { showToast('Not generated yet — click Generate Report Cards first'); }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {toast && <div className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl text-sm font-semibold bg-[#2D2A24] text-white shadow-lg">{toast}</div>}

      <div className="flex items-end justify-between">
        <div>
          <div className="eyebrow">Examinations</div>
          <h1 className="text-3xl font-bold text-[var(--color-text)] -mt-1">Exam Management</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">Create an exam, then follow the steps to publish results.</p>
        </div>
        <button onClick={() => { setExamForm(f => ({ ...f, academic_year_id: selectedYear || '' })); setShowCreate(true); }}
          className="px-4 py-2.5 rounded-xl text-sm font-bold bg-[#2ED05D] text-white hover:bg-[#25B04E]">+ New Exam</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
        <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4 h-fit">
          <h2 className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-wide mb-3">All Exams ({exams.length})</h2>
          {isLoading ? <p className="text-sm text-[var(--color-text-secondary)] py-4">Loading…</p>
            : exams.length === 0 ? <p className="text-sm text-[var(--color-text-secondary)] py-4">No exams yet. Click "New Exam".</p>
            : <div className="space-y-2">
                {exams.map(e => (
                  <button key={e.id} onClick={() => setSelectedExam(e)}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${selectedExam?.id === e.id ? 'bg-[#E8F9ED] border border-emerald-200' : 'bg-[#F7F9FC] hover:bg-gray-100'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-[var(--color-text)] truncate">{e.name || 'Untitled exam'}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeClass(e.status)}`}>{STAGE_LABEL[e.status] || e.status}</span>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{classNameById(e.class_id)} · {new Date(e.start_date).toLocaleDateString()}</p>
                  </button>
                ))}
              </div>}
        </div>

        {!selectedExam ? (
          <div className="bg-white rounded-2xl border border-[var(--color-border)] p-10 text-center text-[var(--color-text-secondary)]">
            Select an exam on the left, or create a new one, to begin.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-xl font-bold text-[var(--color-text)]">{selectedExam.name || 'Untitled exam'}</h2>
                  <p className="text-sm text-[var(--color-text-secondary)]">{classNameById(selectedExam.class_id)} · {sectionNameById(selectedExam.section_id)} · {years.find(y => y.id === selectedExam.academic_year_id)?.name || ''}</p>
                </div>
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${badgeClass(status)}`}>{STAGE_LABEL[status]}</span>
              </div>
              <div className="flex items-center gap-2 mt-5">
                {STAGES.map((st, i) => (
                  <div key={st} className="flex items-center flex-1">
                    <div className={`flex items-center gap-2 ${i <= stageIdx ? 'text-emerald-600' : 'text-gray-400'}`}>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${i <= stageIdx ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}>{i + 1}</span>
                      <span className="text-xs font-semibold hidden sm:inline">{STAGE_LABEL[st]}</span>
                    </div>
                    {i < STAGES.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${i < stageIdx ? 'bg-emerald-500' : 'bg-gray-200'}`} />}
                  </div>
                ))}
              </div>
            </div>

            <StepCard n="1" title="Subjects" subtitle="Add the subjects this exam covers, with their max marks.">
              <div className="flex justify-end mb-3">
                <button onClick={() => setShowSubject(true)} className="px-4 py-2 rounded-lg text-sm font-bold bg-[#2ED05D] text-white hover:bg-[#25B04E]">+ Add Subject</button>
              </div>
              {subjects.length === 0 ? <p className="text-sm text-[var(--color-text-secondary)] text-center py-4">No subjects yet.</p>
                : <div className="space-y-2">
                    {subjects.map(s => (
                      <div key={s.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#F7F9FC]">
                        <span className="text-sm font-semibold text-[var(--color-text)]">{s.subject_name}</span>
                        <span className="text-xs text-[var(--color-text-secondary)]">Max: {s.max_marks}</span>
                      </div>
                    ))}
                  </div>}
            </StepCard>

            <StepCard n="2" title="Enter Marks" subtitle="Type each student's marks for every subject, then save."
              disabled={subjects.length === 0} disabledMsg="Add at least one subject first.">
              {examStudents.length === 0 ? <p className="text-sm text-[var(--color-text-secondary)] text-center py-4">No students found for this exam's section.</p>
                : <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="bg-[#F7F9FC]">
                          <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-secondary)] text-xs sticky left-0 bg-[#F7F9FC]">Student</th>
                          {subjects.map(s => <th key={s.id} className="text-center px-2 py-2 font-semibold text-[var(--color-text-secondary)] text-xs min-w-[90px]">{s.subject_name}<br /><span className="text-[10px] font-normal">Max {s.max_marks}</span></th>)}
                        </tr></thead>
                        <tbody className="divide-y divide-[#f1f5f9]">
                          {examStudents.map(stu => {
                            const nm = `${stu.first_name || ''} ${stu.last_name || ''}`.trim() || stu.email;
                            return (
                              <tr key={stu.id}>
                                <td className="px-3 py-2 font-semibold text-[var(--color-text)] sticky left-0 bg-white text-xs">{nm}</td>
                                {subjects.map(s => {
                                  const subjId = s.subject_id || s.id;
                                  const key = `${stu.id}:${subjId}`;
                                  const existing = results.find(r => r.student_id === stu.id && r.subject_id === subjId);
                                  return (
                                    <td key={s.id} className="px-2 py-2 text-center">
                                      <input type="number" defaultValue={existing?.marks ?? ''}
                                        onChange={e => {
                                          const val = e.target.value === '' ? null : parseFloat(e.target.value);
                                          setMarksEdit(m => ({ ...m, [key]: { student_id: stu.id, subject_id: subjId, marks: val, max_marks: s.max_marks, is_absent: false } }));
                                        }}
                                        className="w-16 px-1.5 py-1 text-xs font-bold text-center border border-[#e2e8f0] rounded-lg focus:border-[#2ED05D] focus:outline-none"
                                        max={s.max_marks} min={0} />
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex justify-end mt-4">
                      <button onClick={doSaveMarks} className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[#2ED05D] text-white hover:bg-[#25B04E]">Save Marks</button>
                    </div>
                  </>}
            </StepCard>

            <StepCard n="3" title="Submit & Publish" subtitle="Move results through review to publish them.">
              <div className="flex flex-wrap items-center gap-3">
                <FlowButton active={status === 'DRAFT'} done={stageIdx > 0} label="Submit" onClick={() => doTransition('submit', 'SUBMITTED')} />
                <FlowButton active={status === 'SUBMITTED'} done={stageIdx > 1} label="Approve" onClick={() => doTransition('approve', 'APPROVED')} />
                <FlowButton active={status === 'APPROVED'} done={stageIdx > 2} label="Publish" onClick={() => doTransition('publish', 'PUBLISHED')} />
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] mt-3">Results become visible to students and parents once published.</p>
            </StepCard>

            <StepCard n="4" title="Results & Report Cards" subtitle="Compute totals and generate report cards."
              disabled={status !== 'PUBLISHED'} disabledMsg="Publish results first.">
              <div className="flex flex-wrap gap-3 mb-4">
                <button onClick={doCompute} className="px-4 py-2 rounded-lg text-sm font-bold bg-white border border-[var(--color-border)] hover:bg-gray-50">Compute Totals</button>
                <button onClick={doReportCards} className="px-4 py-2 rounded-lg text-sm font-bold bg-[#2ED05D] text-white hover:bg-[#25B04E]">Generate Report Cards</button>
              </div>
              {aggregates.length === 0 ? <p className="text-sm text-[var(--color-text-secondary)] text-center py-3">No totals yet — click "Compute Totals".</p>
                : <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-[#F7F9FC] text-left text-xs text-[var(--color-text-secondary)]">
                        <th className="px-3 py-2 font-semibold">Student</th><th className="px-3 py-2 font-semibold text-right">Total</th><th className="px-3 py-2 font-semibold text-right">%</th><th className="px-3 py-2 font-semibold text-center">Grade</th><th className="px-3 py-2 font-semibold text-center">Rank</th><th className="px-3 py-2 font-semibold text-center">Report</th>
                      </tr></thead>
                      <tbody className="divide-y divide-[#f1f5f9]">
                        {aggregates.map(a => (
                          <tr key={a.student_id}>
                            <td className="px-3 py-2 font-semibold text-[var(--color-text)]">{studentName(a.student_id)}</td>
                            <td className="px-3 py-2 text-right">{a.total_marks}/{a.max_total}</td>
                            <td className="px-3 py-2 text-right">{Number(a.percentage).toFixed(1)}%</td>
                            <td className="px-3 py-2 text-center font-bold">{a.grade || '—'}</td>
                            <td className="px-3 py-2 text-center">{a.rank || '—'}</td><td className="px-3 py-2 text-center"><button onClick={() => downloadReportCard(a.student_id)} className="text-emerald-600 font-semibold hover:underline text-xs">Download</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>}
            </StepCard>
          </div>
        )}
      </div>

      {showCreate && (
        <Modal onClose={() => setShowCreate(false)} title="Create Exam">
          <div className="space-y-3">
            <Field label="Exam Name"><input value={examForm.name} onChange={e => setExamForm(f => ({ ...f, name: e.target.value }))} className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl" placeholder="e.g. Mid Term" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Class"><select value={examForm.class_id} onChange={e => setExamForm(f => ({ ...f, class_id: e.target.value, section_id: '' }))} className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl"><option value="">Select</option>{[...classes].sort((a, b) => a.order - b.order).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              <Field label="Section"><select value={examForm.section_id} onChange={e => setExamForm(f => ({ ...f, section_id: e.target.value }))} className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl"><option value="">All sections</option>{sections.filter(s => s.class_id === examForm.class_id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            </div>
            <Field label="Academic Year"><select value={examForm.academic_year_id} onChange={e => setExamForm(f => ({ ...f, academic_year_id: e.target.value }))} className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl"><option value="">Select</option>{years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}</select></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Date"><input type="date" value={examForm.start_date} onChange={e => setExamForm(f => ({ ...f, start_date: e.target.value }))} className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl" /></Field>
              <Field label="End Date"><input type="date" value={examForm.end_date} onChange={e => setExamForm(f => ({ ...f, end_date: e.target.value }))} className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl" /></Field>
            </div>
          </div>
          <ModalActions onCancel={() => setShowCreate(false)} onConfirm={doCreate} confirmLabel="Create" />
        </Modal>
      )}

      {showSubject && selectedExam && (
        <Modal onClose={() => setShowSubject(false)} title="Add Subject">
          <div className="space-y-3">
            <Field label="Subject"><select value={subjectForm.subject_id} onChange={e => setSubjectForm(f => ({ ...f, subject_id: e.target.value }))} className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl"><option value="">Select a subject</option>{allSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Max Marks"><input type="number" value={subjectForm.max_marks} onChange={e => setSubjectForm(f => ({ ...f, max_marks: parseInt(e.target.value) || 100 }))} className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl" /></Field>
              <Field label="Date (optional)"><input type="date" value={subjectForm.date} onChange={e => setSubjectForm(f => ({ ...f, date: e.target.value }))} className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl" /></Field>
            </div>
          </div>
          <ModalActions onCancel={() => setShowSubject(false)} onConfirm={doAddSubject} confirmLabel="Add" />
        </Modal>
      )}
    </div>
  );
}

function StepCard({ n, title, subtitle, children, disabled, disabledMsg }) {
  return (
    <div className={`bg-white rounded-2xl border border-[var(--color-border)] p-5 ${disabled ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3 mb-4">
        <span className="w-8 h-8 rounded-full bg-[#E8F9ED] text-emerald-600 flex items-center justify-center font-bold text-sm shrink-0">{n}</span>
        <div>
          <h3 className="text-base font-bold text-[var(--color-text)]">{title}</h3>
          <p className="text-xs text-[var(--color-text-secondary)]">{subtitle}</p>
        </div>
      </div>
      {disabled ? <p className="text-sm text-[var(--color-text-secondary)] text-center py-3">{disabledMsg}</p> : children}
    </div>
  );
}
function FlowButton({ active, done, label, onClick }) {
  return (
    <button onClick={onClick} disabled={!active}
      className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${done ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : active ? 'bg-[#2ED05D] text-white hover:bg-[#25B04E]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
      {done ? `✓ ${label}` : label}
    </button>
  );
}
function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-[28px] p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-extrabold text-[var(--color-text)] mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1 block">{label}</label>
      {children}
    </div>
  );
}
function ModalActions({ onCancel, onConfirm, confirmLabel }) {
  return (
    <div className="flex justify-end gap-3 mt-6">
      <button onClick={onCancel} className="px-4 py-2.5 rounded-xl text-sm font-bold bg-gray-100 text-[#475569] hover:bg-gray-200">Cancel</button>
      <button onClick={onConfirm} className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[#2ED05D] text-white hover:bg-[#25B04E]">{confirmLabel}</button>
    </div>
  );
}