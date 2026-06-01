import { useState } from 'react';
import {
  PenLine, Plus, Trash2, Edit3, Users, CheckSquare,
  Clock, AlertCircle, ExternalLink, RefreshCw, LogOut,
  ChevronDown, X, Calendar, Award, Loader2,
  Eye, Zap, BarChart2
} from 'lucide-react';
import {
  isConnected, initiateGoogleAuth, clearToken,
  formatDueDate, buildCourseworkPayload, untagTitle
} from '../api/googleClassroom';
import {
  useGCCourses, useGCTypedCoursework, useGCCreateCoursework,
  useGCDeleteCoursework, useGCSubmissions, useGCUpdateCoursework
} from '../hooks/useGoogleClassroom';
import { useAuth } from '../context/AuthContext';

function useCanManage() {
  const { user } = useAuth();
  const roles = user?.roles || [];
  return roles.includes('Administrator') || roles.includes('Instructor') || roles.includes('Academics User');
}

function getDueStatus(dueDate, dueTime) {
  const due = formatDueDate(dueDate, dueTime);
  if (!due) return { label: 'No date', color: 'text-[var(--color-text-secondary)]', bg: 'bg-gray-100 dark:bg-gray-800' };
  const diff = due - new Date();
  const days = Math.ceil(diff / 86400000);
  if (diff < 0) return { label: 'Past', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/40', icon: AlertCircle };
  if (days <= 1) return { label: 'Today/Tomorrow', color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/40', icon: Zap };
  if (days <= 5) return { label: `In ${days} days`, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/40', icon: Clock };
  return { label: due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), color: 'text-[var(--color-text-secondary)]', bg: 'bg-gray-50 dark:bg-gray-900', icon: Calendar };
}

function SubmissionBar({ courseId, courseWorkId }) {
  const { data: subs = [], isLoading } = useGCSubmissions(courseId, courseWorkId);
  if (isLoading) return <span className="text-xs text-[var(--color-text-secondary)]">…</span>;
  const done = subs.filter(s => ['TURNED_IN', 'RETURNED'].includes(s.state)).length;
  const total = subs.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const avgScore = subs
    .filter(s => s.assignedGrade != null)
    .reduce((acc, s, _, arr) => acc + s.assignedGrade / arr.length, 0);

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <div className="w-16 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-[var(--color-text-secondary)]">{done}/{total}</span>
      </div>
      {avgScore > 0 && (
        <span className="text-xs text-[var(--color-text-secondary)]">
          avg {avgScore.toFixed(1)}
        </span>
      )}
    </div>
  );
}

// ─── Class Test Modal ─────────────────────────────────────────────────────────

function TestModal({ courseId, editing, onClose }) {
  const [form, setForm] = useState({
    title: editing ? untagTitle(editing.title) : '',
    description: editing?.description || '',
    dueDate: '',
    points: editing?.maxPoints ?? 25,
  });

  const create = useGCCreateCoursework(courseId);
  const update = useGCUpdateCoursework(courseId);
  const busy = create.isPending || update.isPending;

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = buildCourseworkPayload({ ...form, tag: 'TEST' });
    try {
      if (editing) {
        await update.mutateAsync({ courseWorkId: editing.id, updates: payload });
      } else {
        await create.mutateAsync(payload);
      }
      onClose();
    } catch (err) {
      alert(err.message);
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
              <input type="date" value={form.dueDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Marks</label>
              <input type="number" min={0} value={form.points}
                onChange={e => setForm(f => ({ ...f, points: e.target.value }))}
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

// ─── Test Card ────────────────────────────────────────────────────────────────

function TestCard({ test, courseId, onEdit, onDelete, canManage }) {
  const status = getDueStatus(test.dueDate, test.dueTime);
  const StatusIcon = status.icon;

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] group hover:border-amber-400 hover:shadow-sm transition-all">
      <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
        <CheckSquare size={15} className="text-amber-600" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-[var(--color-text)] truncate">{untagTitle(test.title)}</p>
        {test.description && (
          <p className="text-xs text-[var(--color-text-secondary)] truncate">{test.description}</p>
        )}
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md ${status.bg} ${status.color}`}>
            {StatusIcon && <StatusIcon size={10} />}
            {status.label}
          </span>
          {test.maxPoints && (
            <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
              <Award size={10} />
              {test.maxPoints} marks
            </span>
          )}
          {canManage && <SubmissionBar courseId={courseId} courseWorkId={test.id} />}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <a href={test.alternateLink} target="_blank" rel="noopener noreferrer"
          className="p-1.5 rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-amber-600 transition">
          <ExternalLink size={14} />
        </a>
        {canManage && (
          <>
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

// ─── Course Panel ─────────────────────────────────────────────────────────────

function CoursePanel({ course, canManage }) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expanded, setExpanded] = useState(true);

  const { data: tests = [], isLoading, refetch } = useGCTypedCoursework(course.id, 'TEST');
  const deleteTest = useGCDeleteCoursework(course.id);

  const upcoming = tests.filter(t => {
    const d = formatDueDate(t.dueDate, t.dueTime);
    return !d || d >= new Date();
  });
  const past = tests.filter(t => {
    const d = formatDueDate(t.dueDate, t.dueTime);
    return d && d < new Date();
  });

  return (
    <div className="card">
      <div className="flex items-center justify-between cursor-pointer -mx-6 -mt-6 px-6 pt-6 pb-4 border-b border-[var(--color-border)] mb-4"
        onClick={() => setExpanded(e => !e)}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white font-bold text-sm">
            {course.name?.charAt(0)}
          </div>
          <div>
            <h2 className="font-semibold text-[var(--color-text)]">{course.name}</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {course.section || 'No section'} · {tests.length} test{tests.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={e => { e.stopPropagation(); refetch(); }}
            className="p-2 rounded-lg hover:bg-[var(--color-bg)] text-[var(--color-text-secondary)] transition">
            <RefreshCw size={14} />
          </button>
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
                    <TestCard key={t.id} test={t} courseId={course.id} canManage={canManage}
                      onEdit={t => { setEditing(t); setShowModal(true); }}
                      onDelete={async id => {
                        if (!confirm('Delete this test?')) return;
                        await deleteTest.mutateAsync(id);
                      }} />
                  ))}
                </div>
              )}
              {past.length > 0 && (
                <div className="space-y-2 opacity-70">
                  <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Past</p>
                  {past.map(t => (
                    <TestCard key={t.id} test={t} courseId={course.id} canManage={canManage}
                      onEdit={t => { setEditing(t); setShowModal(true); }}
                      onDelete={async id => {
                        if (!confirm('Delete this test?')) return;
                        await deleteTest.mutateAsync(id);
                      }} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {canManage && showModal && (
        <TestModal courseId={course.id} editing={editing}
          onClose={() => { setShowModal(false); setEditing(null); }} />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ClassTests() {
  const [connected, setConnected] = useState(isConnected());
  const canManage = useCanManage();
  const { data: courses = [], isLoading, error, refetch } = useGCCourses();

  if (!connected) {
    return (
      <div className="space-y-6">
        <div>
          <div className="eyebrow">Module</div>
          <h1 className="text-3xl font-bold text-[var(--color-text)] -mt-1">Class Tests</h1>
        </div>
        <div className="card text-center py-16 max-w-md mx-auto">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
            <PenLine size={36} className="text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">Connect Google Classroom</h2>
          <p className="text-[var(--color-text-secondary)] text-sm mb-8">
            {canManage ? 'Create and manage class tests.' : 'View your class test schedule.'}
          </p>
          <button onClick={() => initiateGoogleAuth('/class-tests')}
            className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-[var(--color-text)] font-medium hover:border-amber-500 hover:shadow-md transition-all">
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="eyebrow">Module</div>
          <h1 className="text-3xl font-bold text-[var(--color-text)] -mt-1">Class Tests</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Google Classroom</span>
          </div>
          <button onClick={refetch} className="p-2 rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] transition">
            <RefreshCw size={15} />
          </button>
          <button onClick={() => { clearToken(); setConnected(false); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] text-xs font-medium transition">
            <LogOut size={13} />
            Disconnect
          </button>
        </div>
      </div>

      {!canManage && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm">
          <Eye size={15} />
          Viewing as student — read only.
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={28} className="animate-spin text-[var(--color-text-secondary)]" />
        </div>
      ) : error ? (
        <div className="card text-center py-12">
          <AlertCircle size={32} className="mx-auto mb-3 text-red-500" />
          <p className="font-medium text-[var(--color-text)]">{error.message}</p>
          <button onClick={refetch} className="mt-4 px-4 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm font-medium hover:border-amber-500 transition">
            Try again
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {courses.map(course => (
            <CoursePanel key={course.id} course={course} canManage={canManage} />
          ))}
        </div>
      )}
    </div>
  );
}