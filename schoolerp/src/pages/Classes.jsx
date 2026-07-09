import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { client } from '../api/frappe';
import { useAuth } from '../context/AuthContext';
import {
  useClasses, useClassDetail, useClassSubjects,
  useLinkSubject, useUnlinkSubject,
  useTeacherAssignments, useCreateTeacherAssignment, useDeleteTeacherAssignment,
  useInstructors,
} from '../hooks/useClasses';
import { useSubjects } from '../hooks/useSubjects';

const chipColors = [
  { bg: '#dbeafe', text: '#1d4ed8' },
  { bg: '#d1fae5', text: '#047857' },
  { bg: '#ede9fe', text: '#7c3aed' },
  { bg: '#fef3c7', text: '#b45309' },
  { bg: '#fce7f3', text: '#be185d' },
  { bg: '#cffafe', text: '#0e7490' },
  { bg: '#fde68a', text: '#92400e' },
  { bg: '#e0e7ff', text: '#4338ca' },
];

/* ── Subject Chips for a single class ─────────────────────────────────── */
function ClassSubjectChips({ classId, canEdit, allSubjects }) {
  const { data: linked = [], isLoading } = useClassSubjects(classId);
  const linkMutation = useLinkSubject();
  const unlinkMutation = useUnlinkSubject();

  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const dropRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setShowAdd(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const linkedIds = new Set(linked.map(s => s.subject_id));
  const available = allSubjects.filter(s => !linkedIds.has(s.id));
  const filtered = available.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.code?.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-1">
        <span className="w-3 h-3 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-[var(--color-text-secondary)]">Loading…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {linked.map((s, i) => (
        <span
          key={s.subject_id}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-200"
          style={{ backgroundColor: chipColors[i % chipColors.length].bg, color: chipColors[i % chipColors.length].text }}
        >
          {s.subject_name}
          {canEdit && (
            <button
              onClick={() => unlinkMutation.mutate({ classId, subjectId: s.subject_id })}
              disabled={unlinkMutation.isPending}
              className="ml-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center hover:opacity-60 transition-opacity text-[10px] leading-none"
              title={`Remove ${s.subject_name}`}
            >
              ×
            </button>
          )}
        </span>
      ))}

      {linked.length === 0 && !canEdit && (
        <span className="text-xs text-[var(--color-text-secondary)] italic">No subjects assigned</span>
      )}

      {canEdit && (
        <div className="relative" ref={dropRef}>
          <button
            onClick={() => setShowAdd(v => !v)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-dashed border-gray-300 text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-all duration-200"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add
          </button>

          {showAdd && (
            <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-xl shadow-xl border border-gray-200 z-40 overflow-hidden">
              <div className="p-2 border-b border-gray-100">
                <input
                  type="text"
                  placeholder="Search subjects…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                  autoFocus
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-[var(--color-text-secondary)] text-center">
                    {available.length === 0 ? 'All subjects linked ✓' : 'No match found'}
                  </p>
                ) : (
                  filtered.map(s => (
                    <button
                      key={s.id}
                      onClick={() => {
                        linkMutation.mutate({ classId, subjectId: s.id });
                        setShowAdd(false);
                        setSearch('');
                      }}
                      disabled={linkMutation.isPending}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] opacity-40" />
                      <span className="font-medium text-[var(--color-text)]">{s.name}</span>
                      <span className="text-[var(--color-text-secondary)] text-xs ml-auto">{s.code}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Teacher Assignment Modal ─────────────────────────────────────────── */
function TeacherModal({ cls, onClose }) {
  const { data: detail, isLoading: loadingDetail } = useClassDetail(cls.id);
  const { data: linked = [], isLoading: loadingSubjects } = useClassSubjects(cls.id);
  const { data: assignments = [], isLoading: loadingAssignments } = useTeacherAssignments(cls.id);
  const { data: instructors = [] } = useInstructors();
  const createMutation = useCreateTeacherAssignment();
  const deleteMutation = useDeleteTeacherAssignment();

  const sections = detail?.sections ?? [];
  const isLoading = loadingDetail || loadingSubjects || loadingAssignments;

  // Build a lookup: `${sectionId}-${subjectId}` → assignment
  const assignmentMap = {};
  assignments.forEach(a => {
    assignmentMap[`${a.section_id}-${a.subject_id}`] = a;
  });

  // Instructor lookup by id
  const instructorMap = {};
  instructors.forEach(t => {
    instructorMap[t.id] = t;
    instructorMap[t.user_id] = t;
  });

  const handleAssign = (sectionId, subjectId, instructorId) => {
    if (!instructorId) return;
    createMutation.mutate({
      instructor_id: instructorId,
      section_id: sectionId,
      subject_id: subjectId,
      class_id: cls.id,
    });
  };

  const handleRemove = (assignmentId) => {
    deleteMutation.mutate({ assignmentId, classId: cls.id });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text)]">
              Class {cls.name} — Teacher Assignments
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
              Assign teachers to each subject in each section
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <span className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-[var(--color-text-secondary)]">Loading…</span>
            </div>
          ) : sections.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[var(--color-text-secondary)]">No sections found for this class. Create sections first.</p>
            </div>
          ) : linked.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[var(--color-text-secondary)]">No subjects linked to this class. Link subjects first.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider bg-gray-50 rounded-tl-lg sticky left-0 z-10 min-w-[120px]">
                      Section
                    </th>
                    {linked.map((subj, i) => (
                      <th
                        key={subj.subject_id}
                        className="text-center px-3 py-3 text-xs font-semibold uppercase tracking-wider bg-gray-50 min-w-[160px]"
                        style={{ color: chipColors[i % chipColors.length].text }}
                      >
                        {subj.subject_name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sections.map(sec => (
                    <tr key={sec.id} className="border-t border-gray-100">
                      <td className="px-4 py-3 sticky left-0 bg-white z-10">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
                            <span className="text-xs font-bold text-[var(--color-primary)]">
                              {(sec.name ?? '?')[0]}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[var(--color-text)]">Section {sec.name}</p>
                            <p className="text-[10px] text-[var(--color-text-secondary)]">Cap: {sec.capacity}</p>
                          </div>
                        </div>
                      </td>
                      {linked.map(subj => {
                        const key = `${sec.id}-${subj.subject_id}`;
                        const assignment = assignmentMap[key];
                        const teacher = assignment ? (instructorMap[assignment.instructor_id] || null) : null;
                        const teacherName = teacher
                          ? `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.email
                          : null;

                        return (
                          <td key={subj.subject_id} className="px-3 py-3 text-center">
                            {assignment ? (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 border border-green-200 text-sm group">
                                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                                  <span className="text-white text-[10px] font-bold">
                                    {(teacherName || '?')[0].toUpperCase()}
                                  </span>
                                </div>
                                <span className="font-medium text-green-800 text-xs max-w-[100px] truncate">
                                  {teacherName || 'Teacher'}
                                </span>
                                <button
                                  onClick={() => handleRemove(assignment.id)}
                                  disabled={deleteMutation.isPending}
                                  className="w-4 h-4 rounded-full flex items-center justify-center text-green-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                  title="Remove assignment"
                                >
                                  ×
                                </button>
                              </div>
                            ) : (
                              <select
                                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-colors cursor-pointer bg-white"
                                value=""
                                onChange={e => handleAssign(sec.id, subj.subject_id, e.target.value)}
                                disabled={createMutation.isPending}
                              >
                                <option value="">— Assign —</option>
                                {instructors.map(t => (
                                  <option key={t.id} value={t.user_id || t.id}>
                                    {`${t.first_name || ''} ${t.last_name || ''}`.trim() || t.email}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="btn-secondary">Close</button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Classes Page ────────────────────────────────────────────────── */
export default function Classes() {
  const { user } = useAuth();
  const isTeacher = user?.roles?.includes('teacher');
  const canEdit = user?.usr === 'Administrator'
    || (user?.roles || []).includes('Administrator')
    || (user?.roles || []).includes('System Manager')
    || (user?.roles || []).includes('super_admin')
    || (user?.roles || []).includes('principal');

  const { data: classes = [], isLoading: loadingClasses } = useClasses();
  const { data: allSubjects = [] } = useSubjects();

  const { data: teacherProfile, isLoading: loadingTeacher } = useQuery({
    queryKey: ['TeacherProfile', user?.email],
    queryFn: async () => {
      const res = await client.get('/academic/my-teaching-profile');
      return res.data;
    },
    enabled: !!(isTeacher && !canEdit),
  });

  const [search, setSearch] = useState('');
  const [teacherModal, setTeacherModal] = useState(null); // class object or null

  const filtered = classes.filter(c =>
    (c.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const totalLinks = classes.reduce((sum, c) => sum + (c.subject_count ?? 0), 0);
  const withSubjects = classes.filter(c => (c.subject_count ?? 0) > 0).length;

  const isLoading = loadingClasses || loadingTeacher;

  // Teacher POV: Restricted View
  if (isTeacher && !canEdit) {
    const assignments = teacherProfile?.assignments || [];
    
    // Group by class to make it look like the curriculum table
    const grouped = {};
    assignments.forEach(a => {
      if (!grouped[a.class_id]) {
        grouped[a.class_id] = {
          class_id: a.class_id,
          class_name: a.class_name,
          class_order: a.class_order,
          subjects: new Map(), // subject_id -> { subject_name, sections: [] }
        };
      }
      
      const classData = grouped[a.class_id];
      if (!classData.subjects.has(a.subject_id)) {
        classData.subjects.set(a.subject_id, {
          subject_id: a.subject_id,
          subject_name: a.subject_name,
          sections: new Set(),
        });
      }
      classData.subjects.get(a.subject_id).sections.add(a.section_name);
    });

    const teacherClasses = Object.values(grouped).sort((a, b) => a.class_order - b.class_order);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="eyebrow">Academics</div>
            <h1 className="text-3xl font-bold text-[var(--color-text)] -mt-1">My Classes & Curriculum</h1>
            <p className="text-[var(--color-text-secondary)] mt-1">
              Your assigned classes and subjects
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <span className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-[var(--color-text-secondary)]">Loading your curriculum…</span>
          </div>
        ) : teacherClasses.length === 0 ? (
          <div className="card text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <p className="text-[var(--color-text-secondary)]">You are not assigned to any classes yet.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider w-44">Class</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Your Subjects & Sections</th>
                  </tr>
                </thead>
                <tbody>
                  {teacherClasses.map((cls, idx) => (
                    <tr key={cls.class_id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors group">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
                            style={{
                              background: `linear-gradient(135deg, ${
                                ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#ec4899','#06b6d4'][idx % 6]
                              }, ${
                                ['#6366f1','#14b8a6','#a855f7','#f97316','#f43f5e','#0ea5e9'][idx % 6]
                              })`
                            }}
                          >
                            {cls.class_name?.split(' ')[0] || '?'}
                          </div>
                          <div>
                            <p className="font-semibold text-[var(--color-text)] leading-tight">Class {cls.class_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          {Array.from(cls.subjects.values()).map((subj, i) => (
                            <span
                              key={subj.subject_id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border"
                              style={{ 
                                backgroundColor: chipColors[i % chipColors.length].bg, 
                                color: chipColors[i % chipColors.length].text,
                                borderColor: 'transparent'
                              }}
                            >
                              {subj.subject_name}
                              <span className="text-[10px] uppercase opacity-70 bg-black/5 px-1.5 py-0.5 rounded ml-1">
                                Sec {Array.from(subj.sections).sort().join(', ')}
                              </span>
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow">Academics</div>
          <h1 className="text-3xl font-bold text-[var(--color-text)] -mt-1">Classes & Curriculum</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">
            Assign subjects to each class — your entire curriculum at a glance
          </p>
        </div>
        {!isLoading && (
          <div className="hidden sm:flex items-center gap-6 text-right">
            <div>
              <p className="text-2xl font-bold text-[var(--color-text)]">{classes.length}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">Classes</p>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div>
              <p className="text-2xl font-bold text-[var(--color-primary)]">{totalLinks}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">Subject Links</p>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div>
              <p className="text-2xl font-bold" style={{ color: withSubjects === classes.length ? '#10b981' : '#f59e0b' }}>
                {withSubjects}/{classes.length}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">Configured</p>
            </div>
          </div>
        )}
      </div>

      {/* Search */}
      {!isLoading && classes.length > 0 && (
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search classes…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input pl-11"
            />
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <span className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-[var(--color-text-secondary)]">Loading classes…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <p className="text-[var(--color-text-secondary)]">
            {search ? 'No classes match your search.' : 'No classes found. Create classes first.'}
          </p>
        </div>
      ) : (
        /* ── Curriculum Table ── */
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider w-44">
                    Class
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                    Subjects
                  </th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider w-24">
                    Count
                  </th>
                  {canEdit && (
                    <th className="text-center px-5 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider w-32">
                      Teachers
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((cls, idx) => (
                  <tr
                    key={cls.id}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors group"
                  >
                    {/* Class Name */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
                          style={{
                            background: `linear-gradient(135deg, ${
                              ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#ec4899','#06b6d4'][idx % 6]
                            }, ${
                              ['#6366f1','#14b8a6','#a855f7','#f97316','#f43f5e','#0ea5e9'][idx % 6]
                            })`
                          }}
                        >
                          {cls.name?.split(' ')[0] || '?'}
                        </div>
                        <div>
                          <p className="font-semibold text-[var(--color-text)] leading-tight">Class {cls.name}</p>
                        </div>
                      </div>
                    </td>

                    {/* Subjects */}
                    <td className="px-5 py-4">
                      <ClassSubjectChips
                        classId={cls.id}
                        canEdit={canEdit}
                        allSubjects={allSubjects}
                      />
                    </td>

                    {/* Count Badge */}
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                        (cls.subject_count ?? 0) > 0
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-400'
                      }`}>
                        {cls.subject_count ?? 0}
                      </span>
                    </td>

                    {/* Manage Teachers Button */}
                    {canEdit && (
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => setTeacherModal(cls)}
                          disabled={(cls.subject_count ?? 0) === 0}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-primary)] bg-[var(--color-primary)]/5 hover:bg-[var(--color-primary)]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          Assign
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Teacher Assignment Modal */}
      {teacherModal && (
        <TeacherModal cls={teacherModal} onClose={() => setTeacherModal(null)} />
      )}
    </div>
  );
}