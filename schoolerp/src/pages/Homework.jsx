import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

import { useAcademicYear } from '../context/AcademicYearContext';
import { useHomeworkList, useCreateHomework, useUpdateHomework, useDeleteHomework } from '../hooks/useHomework';
import { useFrappeList } from '../hooks/useFrappeQuery';
import {
  useGCConnection, useGCConnect, useGCDisconnect, useGCSync,
} from '../hooks/useGoogleClassroom';
import { setupHomeworkDocTypes } from '../utils/setupDocTypes';
import {
  Plus, BookOpen, Clock, AlertCircle, Calendar, Award,
  Trash2, Edit3, X, Loader2, FileText, Users, ChevronDown,
  GraduationCap, Search, Copy, Check, RefreshCw, LogIn, LogOut,
} from 'lucide-react';

function getDueStatus(dueDate) {
  if (!dueDate) return { label: 'No due date', color: 'text-[#8A8680]', bg: 'bg-[#F0EAE4]/60' };
  const now = new Date();
  const due = new Date(dueDate + 'T23:59:59');
  const diff = due - now;
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: 'Overdue', color: 'text-red-600', bg: 'bg-red-50', icon: AlertCircle };
  if (days <= 1) return { label: 'Due today', color: 'text-[#D4732E]', bg: 'bg-[#FFF1E8]', icon: Clock };
  if (days <= 3) return { label: `Due in ${days}d`, color: 'text-[#D4732E]', bg: 'bg-[#FFF1E8]', icon: Clock };
  return { label: `Due ${due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`, color: 'text-[#8A8680]', bg: 'bg-[#F0EAE4]/40', icon: Calendar };
}

function useCanAssign() {
  const { user } = useAuth();
  const roles = user?.roles || [];
  return roles.includes('Administrator') || roles.includes('Instructor') || roles.includes('Academics User');
}

function SyncBadge({ status, gcInviteCode, onRetry }) {
  if (status === 'synced') {
    return (
      <div className="flex items-center gap-2 flex-wrap mt-2 pt-2 border-t border-[#F0EAE4]">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-50 px-2 py-1 rounded-[8px]">
          <Check size={12} />
          Synced to Google Classroom
        </span>
        {gcInviteCode && (
          <button
            onClick={() => navigator.clipboard.writeText(gcInviteCode)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#FF8C42] hover:text-[#E87A30] px-2 py-1 rounded-[8px] hover:bg-[#FFF1E8] transition-[color,background-color] duration-200 cursor-pointer"
            title="Copy invite code"
          >
            <Copy size={12} />
            Invite: {gcInviteCode}
          </button>
        )}
      </div>
    );
  }
  if (status === 'failed') {
    return (
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#F0EAE4]">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-[8px]">
          <AlertCircle size={12} />
          Sync failed
        </span>
        {onRetry && (
          <button onClick={onRetry}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#FF8C42] hover:text-[#E87A30] px-2 py-1 rounded-[8px] hover:bg-[#FFF1E8] transition-[color,background-color] duration-200 cursor-pointer"
          >
            <RefreshCw size={12} />
            Retry
          </button>
        )}
      </div>
    );
  }
  if (status === 'syncing') {
    return (
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#F0EAE4]">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#D4732E] bg-[#FFF1E8] px-2 py-1 rounded-[8px]">
          <Loader2 size={12} className="animate-spin" />
          Syncing to Google Classroom...
        </span>
      </div>
    );
  }
  return null;
}

function HomeworkModal({ editing, courses, groups, onClose }) {
  const { user } = useAuth();
  const { selectedYear } = useAcademicYear();
  const create = useCreateHomework();
  const update = useUpdateHomework();
  const gcConnect = useGCConnect();
  const gcSync = useGCSync();
  const { data: gcState } = useGCConnection();
  const busy = create.isPending || update.isPending || gcSync.isPending;

  const [form, setForm] = useState({
    title: editing?.title || '',
    description: editing?.description || '',
    courseId: editing?.course || '',
    studentGroup: editing?.student_group || '',
    dueDate: editing?.due_date || '',
    maxPoints: editing?.max_points ?? '',
    syncToGC: false,
  });

  const selectedCourse = courses.find(c => c.name === form.courseId);
  const selectedGroup = groups.find(g => g.name === form.studentGroup);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      courseId: form.courseId,
      courseName: selectedCourse?.course_name || form.courseId,
      studentGroup: form.studentGroup,
      className: selectedGroup?.student_group_name || form.studentGroup,
      academicYear: selectedYear || '',
      dueDate: form.dueDate,
      maxPoints: form.maxPoints,
      assignedBy: user?.name || user?.usr || '',
      assignedByName: user?.full_name || user?.usr || '',
    };

    try {
      let result;
      if (editing) {
        await update.mutateAsync({ name: editing.name, updates: payload });
        result = editing;
      } else {
        result = await create.mutateAsync(payload);
      }

      onClose();

      // Fire-and-forget Google Classroom sync — never blocks the save
      if (form.syncToGC && gcState?.connected && result?.name) {
        (async () => {
          try {
            const { getAccessToken } = await import('../api/googleClassroom');
            const token = getAccessToken();
            if (!token) return;
            const syncResult = await gcSync.mutateAsync({
              homework: payload,
              className: payload.className,
              courseName: payload.courseName,
              gcToken: token,
            });
            await update.mutateAsync({
              name: result.name,
              updates: {
                gcCourseId: syncResult.gcCourseId,
                gcCourseWorkId: syncResult.gcCourseWorkId,
                gcInviteCode: syncResult.gcInviteCode,
                gcCourseLink: syncResult.gcCourseLink,
                syncStatus: 'synced',
              },
            });
          } catch (syncErr) {
            console.warn('Google Classroom sync failed:', syncErr.message);
            try {
              await update.mutateAsync({
                name: result.name,
                updates: { syncStatus: 'failed', syncError: syncErr.message },
              });
            } catch (_) { /* best effort */ }
          }
        })();
      }
    } catch (err) {
      alert(err.response?.readableMessage || err.message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-[28px] shadow-[0_24px_64px_rgba(0,0,0,0.12)] w-full max-w-lg border border-[#F0EAE4] animate-in" style={{ animationDelay: '0ms' }}>
        <div className="flex items-center justify-between p-6 pb-4 border-b border-[#F0EAE4]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-[#FFF1E8] flex items-center justify-center">
              <FileText size={18} className="text-[#D4732E]" />
            </div>
            <h2 className="font-semibold text-[#2D2A24] text-base">{editing ? 'Edit Assignment' : 'New Assignment'}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-[10px] hover:bg-[#F0EAE4] text-[#8A8680] transition-[background-color] duration-200 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#8A8680] mb-1.5 uppercase tracking-wide">
                Class <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={form.studentGroup}
                onChange={e => setForm(f => ({ ...f, studentGroup: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-[10px] text-sm border border-[#E8E0D8] bg-white text-[#2D2A24] appearance-none cursor-pointer transition-[border-color,box-shadow] duration-200 focus:border-[#FF8C42] focus:shadow-[0_0_0_3px_rgba(255,140,66,0.1)]"
              >
                <option value="">Select class</option>
                {groups.map(g => (
                  <option key={g.name} value={g.name}>{g.student_group_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#8A8680] mb-1.5 uppercase tracking-wide">
                Subject <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={form.courseId}
                onChange={e => setForm(f => ({ ...f, courseId: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-[10px] text-sm border border-[#E8E0D8] bg-white text-[#2D2A24] appearance-none cursor-pointer transition-[border-color,box-shadow] duration-200 focus:border-[#FF8C42] focus:shadow-[0_0_0_3px_rgba(255,140,66,0.1)]"
              >
                <option value="">Select subject</option>
                {courses.map(c => (
                  <option key={c.name} value={c.name}>{c.course_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8A8680] mb-1.5 uppercase tracking-wide">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              required
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Chapter 5 Review Questions"
              className="w-full px-3.5 py-2.5 rounded-[10px] text-sm border border-[#E8E0D8] bg-white text-[#2D2A24] placeholder:text-[#B0ABA4] transition-[border-color,box-shadow] duration-200 focus:border-[#FF8C42] focus:shadow-[0_0_0_3px_rgba(255,140,66,0.1)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8A8680] mb-1.5 uppercase tracking-wide">
              Description
            </label>
            <textarea
              rows={3}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Describe what students need to do..."
              className="w-full px-3.5 py-2.5 rounded-[10px] text-sm border border-[#E8E0D8] bg-white text-[#2D2A24] placeholder:text-[#B0ABA4] transition-[border-color,box-shadow] duration-200 focus:border-[#FF8C42] focus:shadow-[0_0_0_3px_rgba(255,140,66,0.1)] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#8A8680] mb-1.5 uppercase tracking-wide">
                Due Date
              </label>
              <input
                type="date"
                value={form.dueDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-[10px] text-sm border border-[#E8E0D8] bg-white text-[#2D2A24] transition-[border-color,box-shadow] duration-200 focus:border-[#FF8C42] focus:shadow-[0_0_0_3px_rgba(255,140,66,0.1)]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#8A8680] mb-1.5 uppercase tracking-wide">
                Max Points
              </label>
              <input
                type="number"
                min={0}
                value={form.maxPoints}
                onChange={e => setForm(f => ({ ...f, maxPoints: e.target.value }))}
                placeholder="e.g. 100"
                className="w-full px-3.5 py-2.5 rounded-[10px] text-sm border border-[#E8E0D8] bg-white text-[#2D2A24] placeholder:text-[#B0ABA4] transition-[border-color,box-shadow] duration-200 focus:border-[#FF8C42] focus:shadow-[0_0_0_3px_rgba(255,140,66,0.1)]"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 py-1">
            <input
              type="checkbox"
              checked={form.syncToGC}
              onChange={e => setForm(f => ({ ...f, syncToGC: e.target.checked }))}
              className="w-4 h-4 rounded-[4px] border border-[#E8E0D8] text-[#FF8C42] focus:ring-[#FF8C42] cursor-pointer"
            />
            <span className="text-sm font-medium text-[#2D2A24]">
              Sync to Google Classroom
              {!gcState?.connected && (
                <span className="text-[11px] text-[#8A8680] ml-1.5">(not connected)</span>
              )}
            </span>
          </label>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-[10px] border border-[#E8E0D8] text-[#2D2A24] font-medium text-sm hover:bg-[#F0EAE4] transition-[background-color] duration-200 cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={busy}
              className="flex-1 px-4 py-2.5 rounded-[10px] bg-[#FF8C42] hover:bg-[#E87A30] text-white font-medium text-sm flex items-center justify-center gap-2 transition-[background-color] duration-200 cursor-pointer disabled:opacity-60">
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}
              {editing ? 'Save Changes' : 'Assign Homework'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function HomeworkCard({ hw, onEdit, onDelete, canAssign, onRetrySync }) {
  const status = getDueStatus(hw.due_date);
  const StatusIcon = status.icon;

  return (
    <div className="group relative bg-white rounded-[16px] p-5 border border-[#F0EAE4] shadow-[0_1px_4px_rgba(0,0,0,0.02)] transition-[border-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)] hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.04)] hover:border-[#FFD8B0]">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[#2D2A24] text-[15px] leading-snug truncate">{hw.title}</h3>
          {hw.description && (
            <p className="text-sm text-[#8A8680] mt-1 line-clamp-2 leading-relaxed">{hw.description}</p>
          )}
        </div>

        {canAssign && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-[opacity] duration-200">
            <button onClick={() => onEdit(hw)}
              className="p-1.5 rounded-[8px] hover:bg-[#F0EAE4] text-[#8A8680] hover:text-[#FF8C42] transition-[color,background-color] duration-200 cursor-pointer"
              title="Edit assignment">
              <Edit3 size={14} />
            </button>
            <button onClick={() => onDelete(hw.name)}
              className="p-1.5 rounded-[8px] hover:bg-[#F0EAE4] text-[#8A8680] hover:text-red-500 transition-[color,background-color] duration-200 cursor-pointer"
              title="Delete assignment">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2.5 flex-wrap">
        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-[8px] ${status.bg} ${status.color}`}>
          {StatusIcon && <StatusIcon size={12} />}
          {status.label}
        </span>

        {hw.max_points != null && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#8A8680]">
            <Award size={12} />
            {hw.max_points} pts
          </span>
        )}

        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#8A8680] ml-auto">
          <Users size={12} />
          {hw.class_name || hw.student_group}
        </span>
      </div>

      <SyncBadge
        status={hw.sync_status}
        gcInviteCode={hw.gc_invite_code}
        onRetry={hw.sync_status === 'failed' ? () => onRetrySync(hw) : undefined}
      />
    </div>
  );
}

function CourseGroup({ courseName, assignments, canAssign, onEdit, onDelete, onRetrySync }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-white rounded-[24px] border border-[#F0EAE4] shadow-[0_2px_8px_rgba(0,0,0,0.02)] overflow-hidden transition-[box-shadow] duration-200 hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.03)]">
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer select-none transition-[background-color] duration-200 hover:bg-[#FFF8F4]"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-[10px] bg-[#FFF1E8] flex items-center justify-center shrink-0">
            <BookOpen size={16} className="text-[#D4732E]" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-[#2D2A24] text-sm truncate">{courseName}</h2>
            <p className="text-[11px] font-medium text-[#8A8680] mt-0.5">{assignments.length} assignment{assignments.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <ChevronDown size={16} className={`text-[#8A8680] transition-[transform] duration-300 shrink-0 ${expanded ? 'rotate-180' : ''}`} />
      </div>

      {expanded && (
        <div className="px-5 pb-5 space-y-3">
          {assignments.map(hw => (
            <HomeworkCard
              key={hw.name}
              hw={hw}
              canAssign={canAssign}
              onEdit={onEdit}
              onDelete={onDelete}
              onRetrySync={onRetrySync}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ canAssign, search }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-[28px] border border-[#F0EAE4] shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
      <div className="w-[72px] h-[72px] rounded-[20px] bg-[#FFF1E8] flex items-center justify-center mb-5">
        <BookOpen size={32} className="text-[#FF8C42]/60" />
      </div>
      <h3 className="text-lg font-bold text-[#2D2A24] mb-1">
        {search ? 'No matching assignments' : canAssign ? 'No assignments yet' : 'No assignments assigned'}
      </h3>
      <p className="text-sm font-medium text-[#8A8680] max-w-sm">
        {search ? 'Try adjusting your search terms.' : canAssign ? 'Create your first assignment to get started.' : 'Your teachers have not assigned any homework yet.'}
      </p>
    </div>
  );
}

export default function Homework() {
  const { user } = useAuth();
  const { yearGroups } = useAcademicYear();
  const canAssign = useCanAssign();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [setupDone, setSetupDone] = useState(false);

  const { data: courses = [], isLoading: coursesLoading } = useFrappeList('Course', [], ['name', 'course_name'], 200);
  const { data: allHomework = [], isLoading: hwLoading } = useHomeworkList();
  const deleteHw = useDeleteHomework();
  const updateHw = useUpdateHomework();
  const gcConnect = useGCConnect();
  const gcDisconnect = useGCDisconnect();
  const gcSync = useGCSync();
  const { data: gcState, isLoading: gcLoading } = useGCConnection();

  useEffect(() => {
    if (!setupDone) {
      setSetupDone(true);
      setupHomeworkDocTypes().catch(() => {});
    }
  }, [setupDone]);

  const groups = yearGroups || [];

  const filtered = allHomework.filter(hw => {
    if (!search) return true;
    const q = search.toLowerCase();
    return hw.title?.toLowerCase().includes(q)
      || hw.course_name?.toLowerCase().includes(q)
      || hw.class_name?.toLowerCase().includes(q)
      || hw.description?.toLowerCase().includes(q);
  });

  const grouped = {};
  filtered.forEach(hw => {
    const key = hw.course_name || 'General';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(hw);
  });

  async function handleDelete(name) {
    if (!window.confirm('Delete this assignment?')) return;
    await deleteHw.mutateAsync(name);
  }

  async function handleRetrySync(hw) {
    const { getAccessToken } = await import('../api/googleClassroom');
    const token = getAccessToken();
    if (!token) {
      alert('Google Classroom not connected. Please connect first.');
      return;
    }
    try {
      await updateHw.mutateAsync({ name: hw.name, updates: { syncStatus: 'syncing' } });
      const syncResult = await gcSync.mutateAsync({
        homework: hw,
        className: hw.class_name,
        courseName: hw.course_name,
        gcToken: token,
      });
      await updateHw.mutateAsync({
        name: hw.name,
        updates: {
          gcCourseId: syncResult.gcCourseId,
          gcCourseWorkId: syncResult.gcCourseWorkId,
          gcInviteCode: syncResult.gcInviteCode,
          gcCourseLink: syncResult.gcCourseLink,
          syncStatus: 'synced',
          syncError: null,
        },
      });
    } catch (err) {
      await updateHw.mutateAsync({
        name: hw.name,
        updates: { syncStatus: 'failed', syncError: err.message },
      });
    }
  }

  async function handleGCConnect() {
    try {
      await gcConnect.mutateAsync();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleGCDisconnect() {
    await gcDisconnect.mutateAsync();
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-16">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
        <div>
          <div className="eyebrow">Assignments</div>
          <h1 className="text-[2rem] sm:text-[2.5rem] font-extrabold text-[#2D2A24] tracking-tight leading-[1.1] -mt-1">Homework</h1>
          <p className="text-[#8A8680] mt-2 font-medium text-sm">
            {canAssign
              ? `Manage assignments · ${allHomework.length} total`
              : `${allHomework.length} assignment${allHomework.length !== 1 ? 's' : ''} assigned`}
          </p>
        </div>
        <div className="flex items-stretch sm:items-center gap-3 flex-wrap">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8680] pointer-events-none" />
            <input
              type="text"
              placeholder="Search assignments..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input py-2.5 pl-[34px] pr-3.5 w-48 sm:w-56 text-sm font-medium text-[#2D2A24] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#E8E0D8] transition-[border-color,box-shadow] duration-200 placeholder:text-[#B0ABA4] focus:border-[#FF8C42] focus:shadow-[0_0_0_3px_rgba(255,140,66,0.1)]"
            />
          </div>

          {canAssign && !gcLoading && (
            gcState?.connected ? (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-green-700 bg-green-50 px-2.5 py-1.5 rounded-[8px] flex items-center gap-1">
                  <Check size={12} />
                  {gcState.email || 'Connected'}
                </span>
                <button onClick={handleGCDisconnect}
                  className="p-2 rounded-[10px] border border-[#E8E0D8] text-[#8A8680] hover:bg-[#F0EAE4] hover:text-red-500 transition-[color,background-color] duration-200 cursor-pointer"
                  title="Disconnect Google Classroom"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <button onClick={handleGCConnect} disabled={gcConnect.isPending}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-[10px] border border-[#E8E0D8] text-[#2D2A24] text-sm font-medium hover:bg-[#F0EAE4] transition-[background-color] duration-200 cursor-pointer disabled:opacity-60"
              >
                {gcConnect.isPending ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
                Connect Google Classroom
              </button>
            )
          )}

          {canAssign && (
            <button
              onClick={() => { setEditing(null); setShowModal(true); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-[#FF8C42] hover:bg-[#E87A30] text-white text-sm font-semibold transition-[background-color,transform] duration-200 cursor-pointer active:scale-[0.97]"
            >
              <Plus size={16} />
              Assign
            </button>
          )}
        </div>
      </div>

      {hwLoading || coursesLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin text-[#8A8680]" />
        </div>
      ) : courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-[28px] border border-[#F0EAE4] shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
          <div className="w-[72px] h-[72px] rounded-[20px] bg-[#FFF1E8] flex items-center justify-center mb-5">
            <GraduationCap size={32} className="text-[#FF8C42]/60" />
          </div>
          <h3 className="text-lg font-bold text-[#2D2A24] mb-1">No subjects configured</h3>
          <p className="text-sm font-medium text-[#8A8680] max-w-sm">
            Add subjects in the Subjects section before creating assignments.
          </p>
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <EmptyState canAssign={canAssign} search={search} />
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([courseName, assignments]) => (
            <CourseGroup
              key={courseName}
              courseName={courseName}
              assignments={assignments}
              canAssign={canAssign}
              onEdit={(hw) => { setEditing(hw); setShowModal(true); }}
              onDelete={handleDelete}
              onRetrySync={handleRetrySync}
            />
          ))}
        </div>
      )}

      {showModal && (
        <HomeworkModal
          editing={editing}
          courses={courses}
          groups={groups}
          onClose={() => { setShowModal(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
