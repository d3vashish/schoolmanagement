import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

import { useHomeworkList, useCreateHomework, useUpdateHomework, useDeleteHomework, useMyTeachingProfile } from '../hooks/useHomework';
import {
  Plus, BookOpen, Clock, AlertCircle, Calendar, Award,
  Trash2, Edit3, X, Loader2, FileText, Users, ChevronDown,
  GraduationCap, Search,
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

// Administrators/principals can see everything; teachers can only assign
// for classes in their own teaching profile (enforced again below).
function useCanAssign() {
  const { user } = useAuth();
  const roles = user?.roles || [];
  return roles.includes('Administrator') || roles.includes('Instructor') || roles.includes('Academics User');
}

function HomeworkModal({ editing, teachingAssignments, onClose }) {
  const create = useCreateHomework();
  const update = useUpdateHomework();
  const busy = create.isPending || update.isPending;

  // Find the matching teaching-profile row for an assignment being edited,
  // so the combined dropdown pre-selects correctly.
  const editingAssignmentId = editing
    ? teachingAssignments.find(
        a => a.section_id === editing.section_id && a.subject_id === editing.subject_id
      )?.id
    : '';

  const [form, setForm] = useState({
    title: editing?.title || '',
    description: editing?.description || '',
    assignmentId: editingAssignmentId || '',
    dueDate: editing?.due_date || '',
    maxPoints: editing?.max_points ?? '',
  });

  const selected = teachingAssignments.find(a => a.id === form.assignmentId);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim() || !selected) return;

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      subjectId: selected.subject_id,
      sectionId: selected.section_id,
      className: `${selected.class_name} - ${selected.section_name}`,
      dueDate: form.dueDate || null,
      maxPoints: form.maxPoints,
    };

    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, updates: payload });
      } else {
        await create.mutateAsync(payload);
      }
      onClose();
    } catch (err) {
      alert(err.message);
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
          <div>
            <label className="block text-xs font-semibold text-[#8A8680] mb-1.5 uppercase tracking-wide">
              Class & Subject <span className="text-red-400">*</span>
            </label>
            <select
              required
              value={form.assignmentId}
              onChange={e => setForm(f => ({ ...f, assignmentId: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-[10px] text-sm border border-[#E8E0D8] bg-white text-[#2D2A24] appearance-none cursor-pointer transition-[border-color,box-shadow] duration-200 focus:border-[#FF8C42] focus:shadow-[0_0_0_3px_rgba(255,140,66,0.1)]"
            >
              <option value="">Select class & subject</option>
              {teachingAssignments.map(a => (
                <option key={a.id} value={a.id}>
                  {a.class_name} - {a.section_name} · {a.subject_name}
                </option>
              ))}
            </select>
            {teachingAssignments.length === 0 && (
              <p className="text-[11px] text-[#8A8680] mt-1.5">
                You don't have any classes assigned to you yet. Contact an administrator.
              </p>
            )}
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

function HomeworkCard({ hw, onEdit, onDelete, canAssign }) {
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
            <button onClick={() => onDelete(hw.id)}
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
          {hw.class_name}
        </span>
      </div>
    </div>
  );
}

function SubjectGroup({ subjectName, assignments, canAssign, onEdit, onDelete }) {
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
            <h2 className="font-semibold text-[#2D2A24] text-sm truncate">{subjectName}</h2>
            <p className="text-[11px] font-medium text-[#8A8680] mt-0.5">{assignments.length} assignment{assignments.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <ChevronDown size={16} className={`text-[#8A8680] transition-[transform] duration-300 shrink-0 ${expanded ? 'rotate-180' : ''}`} />
      </div>

      {expanded && (
        <div className="px-5 pb-5 space-y-3">
          {assignments.map(hw => (
            <HomeworkCard
              key={hw.id}
              hw={hw}
              canAssign={canAssign}
              onEdit={onEdit}
              onDelete={onDelete}
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
  const canAssign = useCanAssign();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: allHomework = [], isLoading: hwLoading } = useHomeworkList();
  const { data: teachingProfile, isLoading: profileLoading } = useMyTeachingProfile();
  const deleteHw = useDeleteHomework();

  const teachingAssignments = teachingProfile?.assignments || [];

  const filtered = allHomework.filter(hw => {
    if (!search) return true;
    const q = search.toLowerCase();
    return hw.title?.toLowerCase().includes(q)
      || hw.class_name?.toLowerCase().includes(q)
      || hw.description?.toLowerCase().includes(q);
  });

  const grouped = {};
  filtered.forEach(hw => {
    const assignment = teachingAssignments.find(a => a.subject_id === hw.subject_id);
    const key = assignment?.subject_name || 'General';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(hw);
  });

  async function handleDelete(id) {
    if (!window.confirm('Delete this assignment?')) return;
    await deleteHw.mutateAsync(id);
  }

  const isLoading = hwLoading || profileLoading;

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

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin text-[#8A8680]" />
        </div>
      ) : canAssign && teachingAssignments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-[28px] border border-[#F0EAE4] shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
          <div className="w-[72px] h-[72px] rounded-[20px] bg-[#FFF1E8] flex items-center justify-center mb-5">
            <GraduationCap size={32} className="text-[#FF8C42]/60" />
          </div>
          <h3 className="text-lg font-bold text-[#2D2A24] mb-1">No classes assigned to you</h3>
          <p className="text-sm font-medium text-[#8A8680] max-w-sm">
            Ask an administrator to assign you to a class and subject before creating assignments.
          </p>
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <EmptyState canAssign={canAssign} search={search} />
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([subjectName, assignments]) => (
            <SubjectGroup
              key={subjectName}
              subjectName={subjectName}
              assignments={assignments}
              canAssign={canAssign}
              onEdit={(hw) => { setEditing(hw); setShowModal(true); }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {showModal && (
        <HomeworkModal
          editing={editing}
          teachingAssignments={teachingAssignments}
          onClose={() => { setShowModal(false); setEditing(null); }}
        />
      )}
    </div>
  );
}