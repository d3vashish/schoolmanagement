import { useState } from 'react';
import {
  PenLine, Plus, Trash2, Edit3, Users, CheckSquare,
  Clock, AlertCircle, ChevronDown, X, Calendar, Award, Loader2,
} from 'lucide-react';
import {
  useMyTeachingSections, useClassTests, useClassTestDetail,
  useCreateClassTest, useUpdateClassTest, useDeleteClassTest, useSaveMarks,
} from '../hooks/useClassTests';
import { useAuth } from '../context/AuthContext';

function useCanManage() {
  const { user } = useAuth();
  return user?.roles?.includes('super_admin') || user?.roles?.includes('principal') || user?.roles?.includes('teacher');
}

function fmtDate(d) {
  if (!d) return 'No date set';
  const dt = new Date(d);
  return isNaN(dt) ? d : dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Test Create/Edit Modal ───────────────────────────────────────────────────

function TestModal({ sectionId, editing, onClose }) {
  const [form, setForm] = useState({
    title: editing?.title || '',
    description: editing?.description || '',
    test_date: editing?.test_date || '',
    max_marks: editing?.max_marks ?? 25,
  });

  const create = useCreateClassTest();
  const update = useUpdateClassTest();
  const busy = create.isPending || update.isPending;

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      title: form.title,
      description: form.description || null,
      test_date: form.test_date || null,
      max_marks: Number(form.max_marks),
    };
    try {
      if (editing) {
        await update.mutateAsync({ testId: editing.id, data: payload });
      } else {
        await create.mutateAsync({ ...payload, section_id: sectionId });
      }
      onClose();
    } catch (err) {
      alert(err?.response?.data?.detail || err.message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-[var(--color-surface)] rounded-2xl shadow-2xl w-full max-w-md border border-[var(--color-border)]">
        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
              <PenLine size={18} className="text-amber-600" />
            </div>
            <h2 className="font-semibold text-[var(--color-text)]">
              {editing ? 'Edit Class Test' : 'New Class Test'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--color-bg)] text-[var(--color-text-secondary)]">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
              Test Title <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Chapter 3 Quick Test"
              className="w-full px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
              Topics / Notes
            </label>
            <textarea
              rows={2}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Topics covered in this test..."
              className="w-full px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Date</label>
              <input type="date" value={form.test_date}
                onChange={e => setForm(f => ({ ...f, test_date: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Max Marks</label>
              <input type="number" min={1} required value={form.max_marks}
                onChange={e => setForm(f => ({ ...f, max_marks: e.target.value }))}
                placeholder="25"
                className="w-full px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-[var(--color-text)] font-medium hover:bg-[var(--color-bg)] transition">
              Cancel
            </button>
            <button type="submit" disabled={busy}
              className="flex-1 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium flex items-center justify-center gap-2 transition disabled:opacity-60">
              {busy && <Loader2 size={16} className="animate-spin" />}
              {editing ? 'Save' : 'Create Test'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResultsView({ testId, onClose }) {
  const { data: test, isLoading, error } = useClassTestDetail(testId);

  const scores = (test?.students || [])
    .map(s => s.marks_obtained)
    .filter(v => v !== null && v !== undefined)
    .map(Number);

  const average = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const highest = scores.length ? Math.max(...scores) : null;
  const lowest = scores.length ? Math.min(...scores) : null;

  const sortedStudents = test
    ? [...test.students].sort((a, b) => {
        const av = a.marks_obtained;
        const bv = b.marks_obtained;
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return Number(bv) - Number(av);
      })
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-[var(--color-surface)] rounded-2xl shadow-2xl w-full max-w-lg border border-[var(--color-border)] max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)] shrink-0">
          <div>
            <h2 className="font-semibold text-[var(--color-text)]">{test?.title || 'Results'}</h2>
            {test && <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Out of {Number(test.max_marks)} marks</p>}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--color-bg)] text-[var(--color-text-secondary)]">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-[var(--color-text-secondary)]" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-sm text-red-500">Couldn't load results.</div>
          ) : (
            <>
              <div className="grid grid-cols-3 divide-x divide-[var(--color-border)] border-b border-[var(--color-border)]">
                <div className="px-4 py-4 text-center">
                  <p className="text-lg font-bold text-[var(--color-text)]">{average != null ? average.toFixed(1) : '—'}</p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Average</p>
                </div>
                <div className="px-4 py-4 text-center">
                  <p className="text-lg font-bold text-emerald-600">{highest != null ? highest : '—'}</p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Highest</p>
                </div>
                <div className="px-4 py-4 text-center">
                  <p className="text-lg font-bold text-red-500">{lowest != null ? lowest : '—'}</p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Lowest</p>
                </div>
              </div>

              <div className="p-4 space-y-2">
                {sortedStudents.length === 0 ? (
                  <p className="text-center text-sm text-[var(--color-text-secondary)] py-6">No students in this section.</p>
                ) : (
                  sortedStudents.map(s => {
                    const hasScore = s.marks_obtained !== null && s.marks_obtained !== undefined;
                    const pct = hasScore && test.max_marks ? (Number(s.marks_obtained) / Number(test.max_marks)) * 100 : null;
                    const color = pct == null ? 'text-[var(--color-text-secondary)]' : pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500';
                    return (
                      <div key={s.student_id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-[var(--color-border)]">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--color-text)] truncate">{s.student_name}</p>
                          {s.admission_number && <p className="text-xs text-[var(--color-text-secondary)] truncate">{s.admission_number}</p>}
                        </div>
                        <p className={`text-sm font-bold ${color}`}>
                          {hasScore ? `${s.marks_obtained} / ${Number(test.max_marks)}` : 'Not entered'}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Marks Entry View ──────────────────────────────────────────────────────

function MarksEntryView({ testId, onClose }) {
  const { data: test, isLoading, error } = useClassTestDetail(testId);
  const saveMarks = useSaveMarks();
  const [values, setValues] = useState({});
  const [initialized, setInitialized] = useState(false);

  if (test && !initialized) {
    const initial = {};
    test.students.forEach(s => {
      initial[s.student_id] = s.marks_obtained != null ? String(s.marks_obtained) : '';
    });
    setValues(initial);
    setInitialized(true);
  }

  async function handleSave() {
    const marks = Object.entries(values).map(([student_id, v]) => ({
      student_id,
      marks_obtained: v === '' ? null : Number(v),
    }));
    try {
      await saveMarks.mutateAsync({ testId, marks });
      onClose();
    } catch (err) {
      alert(err?.response?.data?.detail || err.message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-[var(--color-surface)] rounded-2xl shadow-2xl w-full max-w-lg border border-[var(--color-border)] max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)] shrink-0">
          <div>
            <h2 className="font-semibold text-[var(--color-text)]">{test?.title || 'Marks Entry'}</h2>
            {test && <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Out of {Number(test.max_marks)} marks</p>}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--color-bg)] text-[var(--color-text-secondary)]">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-[var(--color-text-secondary)]" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-sm text-red-500">Couldn't load marks.</div>
          ) : test.students.length === 0 ? (
            <div className="text-center py-8 text-sm text-[var(--color-text-secondary)]">No students in this section.</div>
          ) : (
            <div className="space-y-2">
              {test.students.map(s => (
                <div key={s.student_id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-[var(--color-border)]">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text)] truncate">{s.student_name}</p>
                    {s.admission_number && <p className="text-xs text-[var(--color-text-secondary)] truncate">{s.admission_number}</p>}
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={test ? Number(test.max_marks) : undefined}
                    value={values[s.student_id] ?? ''}
                    onChange={e => setValues(v => ({ ...v, [s.student_id]: e.target.value }))}
                    placeholder="—"
                    className="w-20 px-3 py-1.5 text-sm text-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-[var(--color-border)] shrink-0">
          <button onClick={handleSave} disabled={saveMarks.isPending || isLoading}
            className="w-full px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium flex items-center justify-center gap-2 transition disabled:opacity-60">
            {saveMarks.isPending && <Loader2 size={16} className="animate-spin" />}
            Save Marks
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Test Card ────────────────────────────────────────────────────────────────

function TestCard({ test, onEdit, onDelete, onEnterMarks, onViewResults, canManage }) {
  const isPast = test.test_date && new Date(test.test_date) < new Date();

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] group hover:border-amber-400 hover:shadow-sm transition-all">
      <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
        <CheckSquare size={15} className="text-amber-600" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-[var(--color-text)] truncate">{test.title}</p>
        {test.description && (
          <p className="text-xs text-[var(--color-text-secondary)] truncate">{test.description}</p>
        )}
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md ${isPast ? 'bg-gray-100 text-gray-500' : 'bg-amber-50 text-amber-700'}`}>
            <Calendar size={10} />
            {fmtDate(test.test_date)}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
            <Award size={10} />
            Out of {Number(test.max_marks)}
          </span>
          {canManage && (
            <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
              <Users size={10} />
              {test.entered_count}/{test.student_count} entered
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {canManage && (
          <>
            <button onClick={() => onViewResults(test)}
              className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text)] hover:border-amber-400 text-xs font-medium transition">
              Results
            </button>
            <button onClick={() => onEnterMarks(test)}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition">
              Marks
            </button>
            <button onClick={() => onEdit(test)}
              className="p-1.5 rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-amber-600 transition opacity-0 group-hover:opacity-100">
              <Edit3 size={14} />
            </button>
            <button onClick={() => onDelete(test.id)}
              className="p-1.5 rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-red-600 transition opacity-0 group-hover:opacity-100">
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Section Panel ─────────────────────────────────────────────────────────────

function SectionPanel({ section, canManage }) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [marksTestId, setMarksTestId] = useState(null);
  const [resultsTestId, setResultsTestId] = useState(null);
  const [expanded, setExpanded] = useState(true);

  const { data: tests = [], isLoading } = useClassTests(section.section_id);
  const deleteTest = useDeleteClassTest();

  const upcoming = tests.filter(t => !t.test_date || new Date(t.test_date) >= new Date());
  const past = tests.filter(t => t.test_date && new Date(t.test_date) < new Date());

  return (
    <div className="card">
      <div className="flex items-center justify-between cursor-pointer -mx-6 -mt-6 px-6 pt-6 pb-4 border-b border-[var(--color-border)] mb-4"
        onClick={() => setExpanded(e => !e)}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white font-bold text-sm">
            {section.class_name?.charAt(0)}
          </div>
          <div>
            <h2 className="font-semibold text-[var(--color-text)]">{section.class_name} • {section.section_name}</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {tests.length} test{tests.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <button onClick={e => { e.stopPropagation(); setEditing(null); setShowModal(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition">
              <Plus size={14} />
              Add Test
            </button>
          )}
          <ChevronDown size={16} className={`text-[var(--color-text-secondary)] transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {expanded && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-[var(--color-text-secondary)]" />
            </div>
          ) : tests.length === 0 ? (
            <div className="text-center py-10">
              <PenLine size={28} className="mx-auto mb-2 text-[var(--color-text-secondary)] opacity-40" />
              <p className="text-sm text-[var(--color-text-secondary)]">No class tests yet</p>
              {canManage && (
                <button onClick={() => { setEditing(null); setShowModal(true); }}
                  className="mt-3 text-xs text-amber-600 hover:text-amber-700 font-medium">
                  Create the first test →
                </button>
              )}
            </div>
          ) : (
            <>
              {upcoming.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Upcoming</p>
                  {upcoming.map(t => (
                    <TestCard key={t.id} test={t} canManage={canManage}
                      onEdit={t => { setEditing(t); setShowModal(true); }}
                      onEnterMarks={t => setMarksTestId(t.id)}
                      onViewResults={t => setResultsTestId(t.id)}
                      onDelete={async id => {
                        if (!confirm('Delete this test? This also deletes any marks entered.')) return;
                        await deleteTest.mutateAsync({ testId: id });
                      }} />
                  ))}
                </div>
              )}
              {past.length > 0 && (
                <div className="space-y-2 opacity-70">
                  <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Past</p>
                  {past.map(t => (
                    <TestCard key={t.id} test={t} canManage={canManage}
                      onEdit={t => { setEditing(t); setShowModal(true); }}
                      onEnterMarks={t => setMarksTestId(t.id)}
                      onViewResults={t => setResultsTestId(t.id)}
                      onDelete={async id => {
                        if (!confirm('Delete this test? This also deletes any marks entered.')) return;
                        await deleteTest.mutateAsync({ testId: id });
                      }} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {canManage && showModal && (
        <TestModal sectionId={section.section_id} editing={editing}
          onClose={() => { setShowModal(false); setEditing(null); }} />
      )}

      {marksTestId && (
        <MarksEntryView testId={marksTestId} onClose={() => setMarksTestId(null)} />
      )}

      {resultsTestId && (
        <ResultsView testId={resultsTestId} onClose={() => setResultsTestId(null)} />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ClassTests() {
  const canManage = useCanManage();
  const { data: sections = [], isLoading, error, refetch } = useMyTeachingSections();

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="eyebrow">Module</div>
          <h1 className="text-3xl font-bold text-[var(--color-text)] -mt-1">Class Tests</h1>
        </div>
        <button onClick={refetch} className="p-2 rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] transition">
          <Loader2 size={15} className={isLoading ? 'animate-spin' : 'hidden'} />
        </button>
      </div>

      {!canManage && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm">
          Class tests are managed by teachers and admins.
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={28} className="animate-spin text-[var(--color-text-secondary)]" />
        </div>
      ) : error ? (
        <div className="card text-center py-12">
          <AlertCircle size={32} className="mx-auto mb-3 text-red-500" />
          <p className="font-medium text-[var(--color-text)]">{error?.response?.data?.detail || error.message}</p>
          <button onClick={() => refetch()} className="mt-4 px-4 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm font-medium hover:border-amber-500 transition">
            Try again
          </button>
        </div>
      ) : sections.length === 0 ? (
        <div className="card text-center py-16">
          <PenLine size={32} className="mx-auto mb-3 text-[var(--color-text-secondary)] opacity-40" />
          <p className="font-medium text-[var(--color-text)]">No sections assigned to you</p>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Contact your admin to get assigned to a class/section.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map(section => (
            <SectionPanel key={section.section_id} section={section} canManage={canManage} />
          ))}
        </div>
      )}
    </div>
  );
}