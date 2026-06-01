import { useState } from 'react';
import {
  ClipboardList, Plus, Trash2, Edit3, Users,
  Clock, AlertCircle, ExternalLink, RefreshCw, LogOut,
  ChevronDown, X, Calendar, Award, FileText, Loader2,
  GraduationCap, Eye, BookMarked, CheckCircle2, Timer
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

// ─── Role Helper ──────────────────────────────────────────────────────────────

function useCanManage() {
  const { user } = useAuth();
  const roles = user?.roles || [];
  return roles.includes('Administrator') || roles.includes('Instructor') || roles.includes('Academics User');
}

// ─── Due Status ───────────────────────────────────────────────────────────────

function getDueStatus(dueDate, dueTime) {
  const due = formatDueDate(dueDate, dueTime);
  if (!due) return { label: 'No date set', color: 'text-[var(--color-text-secondary)]', bg: 'bg-gray-100 dark:bg-gray-800' };
  const now = new Date();
  const diff = due - now;
  const days = Math.ceil(diff / 86400000);
  if (diff < 0) return { label: 'Past', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/40', icon: AlertCircle };
  if (days <= 1) return { label: 'Tomorrow', color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/40', icon: Timer };
  if (days <= 7) return { label: `In ${days} days`, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-950/40', icon: Clock };
  return { label: due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }), color: 'text-[var(--color-text-secondary)]', bg: 'bg-gray-50 dark:bg-gray-900', icon: Calendar };
}

// ─── Submission Badge ─────────────────────────────────────────────────────────

function SubmissionBadge({ courseId, courseWorkId }) {
  const { data: subs = [], isLoading } = useGCSubmissions(courseId, courseWorkId);
  if (isLoading) return <span className="text-xs text-[var(--color-text-secondary)]">…</span>;
  const graded = subs.filter(s => s.state === 'RETURNED').length;
  const submitted = subs.filter(s => s.state === 'TURNED_IN' || s.state === 'RETURNED').length;
  const total = subs.length;
  const pct = total ? Math.round((submitted / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-[var(--color-text-secondary)]">{submitted}/{total} submitted</span>
      {graded > 0 && (
        <span className="text-xs text-green-600 font-medium">· {graded} graded</span>
      )}
    </div>
  );
}

// ─── Exam Form Modal ──────────────────────────────────────────────────────────

function ExamModal({ courseId, editing, onClose }) {
  const [form, setForm] = useState({
    title: editing ? untagTitle(editing.title) : '',
    description: editing?.description || '',
    dueDate: '',
    points: editing?.maxPoints ?? 100,
    duration: '',
  });

  const create = useGCCreateCoursework(courseId);
  const update = useGCUpdateCoursework(courseId);
  const busy = create.isPending || update.isPending;

  async function handleSubmit(e) {
    e.preventDefault();
    const descWithDuration = form.duration
      ? `${form.description}\n\nDuration: ${form.duration} minutes`
      : form.description;
    const payload = buildCourseworkPayload({
      ...form,
      description: descWithDuration,
      tag: 'EXAM',
    });
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
      <div className="bg-[var(--color-surface)] rounded-2xl shadow-2xl w-full max-w-lg border border-[var(--color-border)]">
        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
              <ClipboardList size={18} className="text-indigo-600" />
            </div>
            <h2 className="font-semibold text-[var(--color-text)]">
              {editing ? 'Edit Exam' : 'Schedule Exam'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--color-bg)] text-[var(--color-text-secondary)]">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
              Exam Title <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Mid-Term Mathematics Examination"
              className="w-full px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
              Instructions / Syllabus
            </label>
            <textarea
              rows={3}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Chapters covered, allowed materials, instructions..."
              className="w-full px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Date</label>
              <input
                type="date"
                value={form.dueDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Total Marks</label>
              <input
                type="number"
                min={0}
                value={form.points}
                onChange={e => setForm(f => ({ ...f, points: e.target.value }))}
                placeholder="100"
                className="w-full px-3 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Duration (min)</label>
              <input
                type="number"
                min={0}
                value={form.duration}
                onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
                placeholder="180"
                className="w-full px-3 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition text-sm"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-[var(--color-text)] font-medium hover:bg-[var(--color-bg)] transition">
              Cancel
            </button>
            <button type="submit" disabled={busy}
              className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center justify-center gap-2 transition disabled:opacity-60">
              {busy && <Loader2 size={16} className="animate-spin" />}
              {editing ? 'Save Changes' : 'Schedule Exam'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Exam Card ────────────────────────────────────────────────────────────────

function ExamCard({ exam, courseId, onEdit, onDelete, canManage }) {
  const status = getDueStatus(exam.dueDate, exam.dueTime);
  const StatusIcon = status.icon;

  // Extract duration if embedded in description
  const durationMatch = exam.description?.match(/Duration:\s*(\d+)\s*minutes/);
  const duration = durationMatch?.[1];

  return (
    <div className="card group relative hover:shadow-md transition-all duration-200 border-l-4 border-l-indigo-500">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[var(--color-text)] truncate">{untagTitle(exam.title)}</h3>
          {exam.description && (
            <p className="text-sm text-[var(--color-text-secondary)] mt-0.5 line-clamp-2">
              {exam.description.replace(/\n\nDuration:.*/, '')}
            </p>
          )}
        </div>
        {canManage && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onEdit(exam)}
              className="p-1.5 rounded-lg hover:bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:text-indigo-600 transition">
              <Edit3 size={14} />
            </button>
            <button onClick={() => onDelete(exam.id)}
              className="p-1.5 rounded-lg hover:bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:text-red-600 transition">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg ${status.bg} ${status.color}`}>
          {StatusIcon && <StatusIcon size={11} />}
          {status.label}
        </span>
        {exam.maxPoints && (
          <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
            <Award size={11} />
            {exam.maxPoints} marks
          </span>
        )}
        {duration && (
          <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
            <Timer size={11} />
            {duration} min
          </span>
        )}
        {canManage && (
          <div className="ml-auto flex items-center gap-1.5">
            <Users size={11} className="text-[var(--color-text-secondary)]" />
            <SubmissionBadge courseId={courseId} courseWorkId={exam.id} />
          </div>
        )}
        <a href={exam.alternateLink} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 transition ml-auto">
          <ExternalLink size={11} />
          View
        </a>
      </div>
    </div>
  );
}

// ─── Course Panel ─────────────────────────────────────────────────────────────

function CoursePanel({ course, canManage }) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expanded, setExpanded] = useState(true);

  const { data: exams = [], isLoading, refetch } = useGCTypedCoursework(course.id, 'EXAM');
  const deleteExam = useGCDeleteCoursework(course.id);

  async function handleDelete(id) {
    if (!confirm('Delete this exam from Google Classroom?')) return;
    await deleteExam.mutateAsync(id);
  }

  const upcoming = exams.filter(e => {
    const d = formatDueDate(e.dueDate, e.dueTime);
    return !d || d >= new Date();
  });
  const past = exams.filter(e => {
    const d = formatDueDate(e.dueDate, e.dueTime);
    return d && d < new Date();
  });

  return (
    <div className="card">
      <div className="flex items-center justify-between cursor-pointer -mx-6 -mt-6 px-6 pt-6 pb-4 border-b border-[var(--color-border)] mb-4"
        onClick={() => setExpanded(e => !e)}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
            {course.name?.charAt(0)}
          </div>
          <div>
            <h2 className="font-semibold text-[var(--color-text)]">{course.name}</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {course.section || 'No section'} · {upcoming.length} upcoming · {past.length} past
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition">
              <Plus size={14} />
              Schedule Exam
            </button>
          )}
          <ChevronDown size={16} className={`text-[var(--color-text-secondary)] transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {expanded && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-[var(--color-text-secondary)]" />
            </div>
          ) : exams.length === 0 ? (
            <div className="text-center py-10">
              <ClipboardList size={32} className="mx-auto mb-2 text-[var(--color-text-secondary)] opacity-40" />
              <p className="text-sm text-[var(--color-text-secondary)]">No exams scheduled</p>
              {canManage && (
                <button onClick={() => { setEditing(null); setShowModal(true); }}
                  className="mt-3 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                  Schedule the first exam →
                </button>
              )}
            </div>
          ) : (
            <>
              {upcoming.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Upcoming</p>
                  <div className="space-y-3">
                    {upcoming.map(exam => (
                      <ExamCard key={exam.id} exam={exam} courseId={course.id}
                        canManage={canManage}
                        onEdit={e => { setEditing(e); setShowModal(true); }}
                        onDelete={handleDelete} />
                    ))}
                  </div>
                </div>
              )}
              {past.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Past</p>
                  <div className="space-y-3 opacity-70">
                    {past.map(exam => (
                      <ExamCard key={exam.id} exam={exam} courseId={course.id}
                        canManage={canManage}
                        onEdit={e => { setEditing(e); setShowModal(true); }}
                        onDelete={handleDelete} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {canManage && showModal && (
        <ExamModal courseId={course.id} editing={editing}
          onClose={() => { setShowModal(false); setEditing(null); }} />
      )}
    </div>
  );
}

// ─── Connect Screen ───────────────────────────────────────────────────────────

function ConnectScreen({ canManage }) {
  return (
    <div className="card text-center py-16 max-w-md mx-auto">
      <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
        <BookMarked size={36} className="text-indigo-600" />
      </div>
      <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">Connect Google Classroom</h2>
      <p className="text-[var(--color-text-secondary)] text-sm mb-8 max-w-sm mx-auto">
        {canManage
          ? 'Sign in to schedule exams, set marks, and track student submissions.'
          : 'Sign in to view your upcoming exams and results.'}
      </p>
      <button onClick={() => initiateGoogleAuth('/exams')}
        className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-[var(--color-text)] font-medium hover:border-indigo-500 hover:shadow-md transition-all duration-200">
        <svg width="20" height="20" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Sign in with Google
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Exams() {
  const [connected, setConnected] = useState(isConnected());
  const canManage = useCanManage();
  const { data: courses = [], isLoading, error, refetch } = useGCCourses();

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="eyebrow">Module</div>
          <h1 className="text-3xl font-bold text-[var(--color-text)] -mt-1">Exams</h1>
        </div>
        {connected && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-xs font-medium text-indigo-700 dark:text-indigo-400">Google Classroom</span>
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
        )}
      </div>

      {connected && !canManage && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 text-sm">
          <Eye size={15} />
          You are viewing exams as a student.
        </div>
      )}

      {!connected ? (
        <ConnectScreen canManage={canManage} />
      ) : isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={28} className="animate-spin text-[var(--color-text-secondary)]" />
        </div>
      ) : error ? (
        <div className="card text-center py-12">
          <AlertCircle size={32} className="mx-auto mb-3 text-red-500" />
          <p className="font-medium text-[var(--color-text)]">Failed to load courses</p>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">{error.message}</p>
          <button onClick={refetch} className="mt-4 px-4 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm font-medium hover:border-indigo-500 transition">
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