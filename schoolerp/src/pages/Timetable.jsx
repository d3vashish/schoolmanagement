import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../context/AuthContext';
import { useAcademicYear } from '../context/AcademicYearContext';
import { getList, adminGetList } from '../api/frappe';
import { useTimetable } from '../hooks/useTimetable';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIODS = [
  { no: 1, label: '08:00', time: '08:00' },
  { no: 2, label: '09:00', time: '09:00' },
  { no: 3, label: '10:00', time: '10:00' },
  { no: 4, label: '11:00', time: '11:00' },
  { no: 5, label: '12:00', time: '12:00' },
  { no: 6, label: '13:00', time: '13:00' },
  { no: 7, label: '14:00', time: '14:00' },
  { no: 8, label: '15:00', time: '15:00' },
  { no: 9, label: '16:00', time: '16:00' },
];

const DAY_THEMES = {
  Monday:    { bg: '#E8F9ED', border: '#BBF7D0', accent: '#2ED05D', label: '#25B04E', emoji: 'M' },
  Tuesday:   { bg: '#E8F7FF', border: '#B0E0FF', accent: '#8ED8F8', label: '#2E8BB0', emoji: 'T' },
  Wednesday: { bg: '#F0EBFF', border: '#D4C8FF', accent: '#A98CF5', label: '#6B4FCF', emoji: 'W' },
  Thursday:  { bg: '#FFF9E0', border: '#FFE88A', accent: '#0ea5e9', label: '#8B6F00', emoji: 'T' },
  Friday:    { bg: '#E8FFF0', border: '#B0FFCA', accent: '#B7E66B', label: '#4A8C00', emoji: 'F' },
  Saturday:  { bg: '#FFE8EC', border: '#FFB0BA', accent: '#FF6B6B', label: '#C44040', emoji: 'S' },
};

const SLOT_COLORS = [
  { bg: '#2ED05D', text: '#fff' },
  { bg: '#A98CF5', text: '#fff' },
  { bg: '#8ED8F8', text: '#1a3a4a' },
  { bg: '#B7E66B', text: '#2a4a00' },
  { bg: '#0ea5e9', text: '#5a4200' },
  { bg: '#FF6B6B', text: '#fff' },
  { bg: '#5EC8E5', text: '#fff' },
  { bg: '#FFB38A', text: '#5a2a00' },
];

const slotSchema = z.object({
  section_id: z.string().min(1, 'Class is required'),
  subject_id: z.string().min(1, 'Subject is required'),
  instructor_id: z.string().min(1, 'Teacher is required'),
  day_of_week: z.number().int().min(0).max(6),
  period_no: z.number().int().min(1).max(9),
});

function getSlotColor(courseName) {
  if (!courseName) return SLOT_COLORS[0];
  let hash = 0;
  for (let i = 0; i < courseName.length; i++) {
    hash = courseName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SLOT_COLORS[Math.abs(hash) % SLOT_COLORS.length];
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function getCurrentDayAndTime() {
  const now = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const day = dayNames[now.getDay()];
  const hour = String(now.getHours()).padStart(2, '0') + ':00';
  return { day, hour };
}

export default function Timetable() {
  const { user } = useAuth();
  const { selectedYear } = useAcademicYear();
  const isTeacher = user?.roles?.includes('Instructor');
  const isAdmin = user?.usr === 'Administrator' || (user?.roles || []).includes('Administrator') || (user?.roles || []).includes('System Manager');
  const canEdit = isAdmin;

  const teacherGroupNames = isTeacher
    ? [...new Set([user.myGroupName, ...(user.mySubjectGroups || [])].filter(Boolean))]
    : [];

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [hoveredSlot, setHoveredSlot] = useState(null);

  const groupFilters = [];
  if (isTeacher && teacherGroupNames.length > 0) {
    groupFilters.push(['name', 'in', teacherGroupNames]);
  } else if (!isTeacher && selectedYear) {
    groupFilters.push(['academic_year', '=', selectedYear]);
  }

  const filters = {};
  if (!isTeacher && selectedGroup) filters.section_id = selectedGroup;

  const { slots, create, update, remove, saving } = useTimetable(filters);

  const { data: courses = [] } = useQuery({
    queryKey: ['Course', 'list', isAdmin],
    queryFn: () => isAdmin
      ? adminGetList('Course', [], ['name', 'course_name'], 100)
      : getList('Course', [], ['name', 'course_name'], 100),
    staleTime: 2 * 60 * 1000,
  });
  const { data: groups = [] } = useQuery({
    queryKey: ['Student Group', 'list', isTeacher, teacherGroupNames.join(','), selectedYear, isAdmin],
    queryFn: () => isAdmin
      ? adminGetList('Student Group', groupFilters, ['name', 'student_group_name'], 100)
      : getList('Student Group', groupFilters, ['name', 'student_group_name'], 100),
    staleTime: 2 * 60 * 1000,
  });
  const { data: instructors = [] } = useQuery({
    queryKey: ['Instructor', 'list', isAdmin],
    queryFn: () => isAdmin
      ? adminGetList('Instructor', [['status', '=', 'Active']], ['name', 'instructor_name'], 100)
      : getList('Instructor', [['status', '=', 'Active']], ['name', 'instructor_name'], 100),
    staleTime: 2 * 60 * 1000,
  });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(slotSchema),
    defaultValues: {
      section_id: '',
      subject_id: '',
      instructor_id: '',
      day_of_week: 0,
      period_no: 1,
    },
  });

  const watchedDay = watch('day_of_week');

  useEffect(() => {
    if (!isTeacher && groups.length > 0 && !selectedGroup) {
      setSelectedGroup(groups[0].name);
    }
  }, [groups, isTeacher, selectedGroup]);

  const yearGroupNames = groups.map(g => g.name);
  const slotList = slots.data || [];
  const filteredSchedules = selectedGroup
    ? slotList.filter(s => s.section_id === selectedGroup)
    : isTeacher
      ? slotList
      : selectedYear
        ? slotList.filter(s => yearGroupNames.includes(s.section_id))
        : slotList;

  const grid = useMemo(() => {
    const g = {};
    DAYS.forEach(d => { g[d] = {}; PERIODS.forEach(p => { g[d][p.no] = []; }); });
    filteredSchedules.forEach(s => {
      const day = DAYS[s.day_of_week];
      if (g[day] && s.period_no && g[day][s.period_no] !== undefined) {
        g[day][s.period_no].push(s);
      }
    });
    return g;
  }, [filteredSchedules]);

  const totalSlots = filteredSchedules.length;
  const uniqueCourses = new Set(filteredSchedules.map(s => s.subject_name)).size;
  const uniqueTeachers = new Set(filteredSchedules.map(s => s.instructor_name)).size;

  const { day: currentDay, hour: currentHour } = getCurrentDayAndTime();
  const currentPeriodNo = PERIODS.find(p => p.time === currentHour)?.no || null;

  const openAdd = () => {
    setEditingId(null);
    reset({
      section_id: teacherGroupNames.length === 1 ? teacherGroupNames[0] : '',
      subject_id: '',
      instructor_id: '',
      day_of_week: 0,
      period_no: 1,
    });
    setShowModal(true);
  };

  const openEdit = (slot) => {
    setEditingId(slot.id);
    reset({
      section_id: slot.section_id,
      subject_id: slot.subject_id,
      instructor_id: slot.instructor_id,
      day_of_week: slot.day_of_week,
      period_no: slot.period_no,
    });
    setShowModal(true);
  };

  const onSubmit = (data) => {
    if (editingId) {
      update.mutate({ id: editingId, data });
    } else {
      create.mutate({ ...data, academic_year_id: selectedYear });
    }
    setShowModal(false);
    setEditingId(null);
  };

  const handleDelete = (slot) => {
    if (!window.confirm(`Delete this schedule entry?`)) return;
    remove.mutate(slot.id);
  };

  const courseName = (id) => courses.find(c => c.name === id)?.course_name || id;
  const groupName = (id) => groups.find(g => g.name === id)?.student_group_name || id;

  const dayPeriodCounts = useMemo(() => {
    const counts = {};
    DAYS.forEach(d => {
      counts[d] = PERIODS.reduce((sum, p) => sum + (grid[d][p.no]?.length || 0), 0);
    });
    return counts;
  }, [grid]);

  if (slots.isLoading) {
    return (
      <div className="space-y-6 animate-fade">
        <div>
          <div className="eyebrow">Academics</div>
          <h1 className="text-3xl font-bold text-[var(--color-text)] -mt-1">Timetable</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">Weekly class schedule</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card shimmer h-24 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card shimmer h-80 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4 animate-in">
        <div>
          <div className="eyebrow">Academics</div>
          <h1 className="text-3xl font-bold text-[var(--color-text)] -mt-1">Timetable</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">Weekly class schedule</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {isTeacher ? (
            <div className="text-sm font-semibold text-[var(--color-primary)] px-3 py-1.5 bg-[var(--color-primary)]/10 rounded-lg">
              My Schedule
            </div>
          ) : (
            <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)} className="input w-52">
              {groups.map(g => <option key={g.name} value={g.name}>{g.student_group_name || g.name}</option>)}
            </select>
          )}
          {canEdit && (
            <button onClick={openAdd} className="btn-primary flex items-center gap-2 group btn-press">
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center transition-all duration-300 group-hover:bg-white/30 group-hover:scale-110">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </span>
              Add Period
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 animate-in" style={{ animationDelay: '60ms' }}>
        <div className="stat-card flex items-center gap-4 group cursor-default">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2ED05D] to-[#90EEB0] flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--color-text)]">{totalSlots}</p>
            <p className="text-xs text-[var(--color-text-secondary)] font-medium">Total Periods</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-4 group cursor-default">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#A98CF5] to-[#C4AAFF] flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--color-text)]">{uniqueCourses}</p>
            <p className="text-xs text-[var(--color-text-secondary)] font-medium">Subjects</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-4 group cursor-default">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#8ED8F8] to-[#B0E8FF] flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--color-text)]">{uniqueTeachers}</p>
            <p className="text-xs text-[var(--color-text-secondary)] font-medium">Teachers</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 animate-in" style={{ animationDelay: '120ms' }}>
        {DAYS.map((day, dayIdx) => {
          const theme = DAY_THEMES[day];
          const isToday = day === currentDay;
          const periodCount = dayPeriodCounts[day];

          return (
            <div key={day} className={`rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 ${isToday ? 'ring-2 ring-[var(--color-primary)] ring-offset-2' : ''}`}
              style={{
                background: theme.bg,
                boxShadow: isToday ? `0 8px 30px ${theme.accent}30, 0 0 0 1px ${theme.border}` : `0 4px 16px ${theme.accent}15, 0 0 0 1px ${theme.border}`,
              }}
            >
              <div className="px-4 py-3 flex items-center justify-between"
                style={{ background: `linear-gradient(135deg, ${theme.accent}20, ${theme.accent}08)` }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold transition-transform duration-300 hover:scale-110"
                    style={{ background: theme.accent, color: '#fff' }}>
                    {theme.emoji}
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: theme.label }}>{day}</p>
                    {isToday && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 inline-block"
                        style={{ background: theme.accent, color: '#fff' }}>
                        Today
                      </span>
                    )}
                  </div>
                </div>
                {periodCount > 0 && (
                  <span className="text-xs font-bold px-2 py-1 rounded-lg"
                    style={{ background: `${theme.accent}20`, color: theme.label }}>
                    {periodCount}
                  </span>
                )}
              </div>

              <div className="p-2 space-y-2 min-h-[320px]">
                {PERIODS.map((period) => {
                  const slotsInPeriod = grid[day][period.no] || [];
                  const isCurrentSlot = isToday && currentPeriodNo === period.no;

                  if (slotsInPeriod.length === 0) {
                    return isCurrentSlot ? (
                      <div key={period.no} className="relative px-2 py-1.5 rounded-xl border-2 border-dashed opacity-60"
                        style={{ borderColor: theme.accent + '40' }}>
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: theme.accent }} />
                          <span className="text-[10px] font-semibold" style={{ color: theme.label }}>
                            {formatTime(period.time)}
                          </span>
                          <span className="text-[10px] text-[var(--color-text-muted)]">Free</span>
                        </div>
                      </div>
                    ) : null;
                  }

                  return slotsInPeriod.map((slot, slotIdx) => {
                    const color = getSlotColor(slot.subject_name);
                    const isHovered = hoveredSlot === slot.id;
                    const globalIdx = dayIdx * 10 + period.no * 3 + slotIdx;

                    return (
                      <div key={slot.id} className={`rounded-xl p-2.5 transition-all duration-200 relative group ${canEdit ? 'cursor-pointer active:scale-[0.97]' : ''} ${isCurrentSlot ? 'ring-2 ring-white ring-offset-1' : ''}`}
                        style={{
                          background: `linear-gradient(135deg, ${color.bg}, ${color.bg}dd)`,
                          color: color.text,
                          boxShadow: isHovered ? `0 8px 24px ${color.bg}50, inset 0 1px 0 rgba(255,255,255,0.3)` : `0 2px 8px ${color.bg}30, inset 0 1px 0 rgba(255,255,255,0.2)`,
                          animationDelay: `${globalIdx * 30}ms`,
                          opacity: 0,
                          animation: `fadeInUp 0.3s var(--ease-out) ${globalIdx * 30}ms forwards`,
                        }}
                        onClick={() => canEdit && openEdit(slot)}
                        onMouseEnter={() => setHoveredSlot(slot.id)}
                        onMouseLeave={() => setHoveredSlot(null)}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-white/25">
                            P{slot.period_no} · {formatTime(period.time)}
                          </span>
                          {isCurrentSlot && (
                            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                          )}
                        </div>

                        {isTeacher && (
                          <div className="mb-1">
                            <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-md bg-black/15 text-white/90 truncate max-w-full inline-block">
                              {groupName(slot.section_id)}
                            </span>
                          </div>
                        )}

                        <p className="text-xs font-bold leading-snug truncate mb-1">
                          {slot.subject_name || courseName(slot.subject_id)}
                        </p>

                        {(slot.instructor_name || slot.instructor_id) && (
                          <p className="text-[10px] opacity-75 truncate flex items-center gap-1">
                            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {slot.instructor_name}
                          </p>
                        )}

                        {canEdit && (
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(slot); }}
                            className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 w-5 h-5 bg-white/30 backdrop-blur-sm rounded-lg hover:bg-white/50 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    );
                  });
                })}

                {PERIODS.every(p => (grid[day][p.no] || []).length === 0) && (
                  <div className="flex flex-col items-center justify-center py-8 opacity-50">
                    <svg className="w-8 h-8 mb-2" style={{ color: theme.accent }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 12H4" />
                    </svg>
                    <p className="text-[10px] font-medium" style={{ color: theme.label }}>No classes</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card p-4 animate-in" style={{ animationDelay: '180ms' }}>
        <h3 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Period Schedule</h3>
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((period) => {
            const isNow = period.time === currentHour && currentDay !== 'Sunday';
            return (
              <div key={period.no} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 ${isNow ? 'bg-[var(--color-primary)] text-white shadow-md' : 'bg-gray-50 text-[var(--color-text-secondary)] hover:bg-gray-100'}`}>
                <span className="w-5 h-5 rounded-lg bg-white/20 flex items-center justify-center text-[10px] font-bold">
                  {period.no}
                </span>
                {formatTime(period.time)}
              </div>
            );
          })}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden"
            style={{
              boxShadow: '0 25px 80px rgba(0,0,0,0.15), 0 0 0 1px rgba(46,208,93,0.12)',
              animation: 'scaleIn 0.25s var(--ease-spring) forwards',
            }}
          >
            <div className="px-6 pt-6 pb-4 bg-gradient-to-br from-[var(--color-primary-light)] to-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {editingId ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      )}
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[var(--color-text)]">{editingId ? 'Edit Period' : 'Add Period'}</h2>
                    <p className="text-xs text-[var(--color-text-secondary)]">{editingId ? 'Update schedule details' : 'Add a new class to the timetable'}</p>
                  </div>
                </div>
                <button onClick={() => { setShowModal(false); setEditingId(null); }}
                  className="w-8 h-8 rounded-xl bg-black/5 flex items-center justify-center hover:bg-black/10 transition-all duration-200 hover:scale-110 active:scale-95 btn-press">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[var(--color-text)] mb-1.5">Subject</label>
                <select {...register('subject_id')} className="input">
                  <option value="">Select Subject</option>
                  {courses.map(c => <option key={c.name} value={c.name}>{c.course_name || c.name}</option>)}
                </select>
                {errors.subject_id && <p className="text-xs text-red-500 mt-1">{errors.subject_id.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--color-text)] mb-1.5">Class</label>
                {isTeacher && teacherGroupNames.length === 1 ? (
                  <div className="input flex items-center bg-gray-50 text-gray-700 font-medium">
                    {teacherGroupNames[0]}
                  </div>
                ) : (
                  <select {...register('section_id')} className="input">
                    <option value="">Select Class</option>
                    {groups.map(g => <option key={g.name} value={g.name}>{g.student_group_name || g.name}</option>)}
                  </select>
                )}
                {errors.section_id && <p className="text-xs text-red-500 mt-1">{errors.section_id.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--color-text)] mb-1.5">
                  Teacher <span className="text-[var(--color-danger)]">*</span>
                </label>
                <select {...register('instructor_id')} className="input">
                  <option value="">Select Teacher</option>
                  {instructors.map(i => <option key={i.name} value={i.name}>{i.instructor_name || i.name}</option>)}
                </select>
                {errors.instructor_id && <p className="text-xs text-red-500 mt-1">{errors.instructor_id.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--color-text)] mb-1.5">Day</label>
                <div className="grid grid-cols-6 gap-1.5">
                  {DAYS.map((d, idx) => {
                    const theme = DAY_THEMES[d];
                    const isSelected = watchedDay === idx;
                    return (
                      <button key={d} type="button" onClick={() => setValue('day_of_week', idx)}
                        className="py-2 rounded-xl text-xs font-bold transition-all duration-200 btn-press"
                        style={{
                          background: isSelected ? theme.accent : theme.bg,
                          color: isSelected ? '#fff' : theme.label,
                          boxShadow: isSelected ? `0 4px 12px ${theme.accent}40` : 'none',
                          border: `2px solid ${isSelected ? theme.accent : theme.border}`,
                        }}>
                        {theme.emoji}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--color-text)] mb-1.5">Period</label>
                <select {...register('period_no', { valueAsNumber: true })} className="input">
                  {PERIODS.map(p => (
                    <option key={p.no} value={p.no}>Period {p.no} ({formatTime(p.time)} &ndash; {formatTime(PERIODS[p.no]?.time || '17:00')})</option>
                  ))}
                </select>
                {errors.period_no && <p className="text-xs text-red-500 mt-1">{errors.period_no.message}</p>}
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => { setShowModal(false); setEditingId(null); }} className="btn-secondary btn-press">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-50 btn-press">
                  {saving && <span className="w-4 h-4 flex items-center justify-center"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /></span>}
                  {editingId ? 'Update' : 'Add Period'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
