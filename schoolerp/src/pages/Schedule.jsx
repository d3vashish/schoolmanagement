import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAcademicYear } from '../context/AcademicYearContext';
import { getList } from '../api/frappe';
import { useQuery } from '@tanstack/react-query';
import AssignClassModal from '../components/AssignClassModal';

const fmt = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
};

const parseDateStr = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts[0].length === 4) return new Date(dateStr);
  return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
};

const dayName  = (dateStr) => parseDateStr(dateStr)?.toLocaleDateString('en-US', { weekday: 'long' }) || '';
const shortDay = (dateStr) => parseDateStr(dateStr)?.toLocaleDateString('en-US', { weekday: 'short' }) || '';
const niceDate = (dateStr) => parseDateStr(dateStr)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) || '';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const PALETTES = [
  { card: 'bg-sky-50 border-sky-200',     time: 'text-sky-600',     title: 'text-sky-900',     badge: 'bg-sky-100 text-sky-700',     dot: 'bg-sky-400'     },
  { card: 'bg-violet-50 border-violet-200', time: 'text-[#2ED05D]', title: 'text-violet-900', badge: 'bg-[#BBF7D0] text-violet-700', dot: 'bg-violet-400' },
  { card: 'bg-emerald-50 border-emerald-200', time: 'text-emerald-600', title: 'text-emerald-900', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-400' },
  { card: 'bg-emerald-50 border-emerald-200', time: 'text-emerald-600', title: 'text-emerald-900', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-400' },
  { card: 'bg-rose-50 border-rose-200',   time: 'text-rose-600',    title: 'text-rose-900',    badge: 'bg-rose-100 text-rose-700',    dot: 'bg-rose-400'    },
  { card: 'bg-emerald-50 border-emerald-200', time: 'text-emerald-600', title: 'text-emerald-900', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-400' },
  { card: 'bg-teal-50 border-teal-200',   time: 'text-teal-600',    title: 'text-teal-900',    badge: 'bg-teal-100 text-teal-700',    dot: 'bg-teal-400'    },
  { card: 'bg-pink-50 border-pink-200',   time: 'text-pink-600',    title: 'text-pink-900',    badge: 'bg-pink-100 text-pink-700',    dot: 'bg-pink-400'    },
];

export default function Schedule() {
  const { user } = useAuth();
  const { selectedYear } = useAcademicYear();
  const isTeacher = user?.roles?.includes('Instructor');
  const teacherGroupNames = isTeacher
    ? [...new Set([user.myGroupName, ...(user.mySubjectGroups || [])].filter(Boolean))]
    : [];

  const [selectedProgram, setSelectedProgram] = useState('');
  const [selectedInstructor, setSelectedInstructor] = useState('');
  const [view, setView] = useState('week');
  const [isAssigning, setIsAssigning] = useState(false);

  // Fetch schedules — teachers filtered by their groups, admins by year
  const { data: schedules = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['Schedule', 'schedules', selectedYear, isTeacher, teacherGroupNames.join(',')],
    queryFn: async () => {
      if (isTeacher && teacherGroupNames.length > 0) {
        // Teacher: filter by their groups directly
        return getList('Course Schedule',
          [['student_group', 'in', teacherGroupNames]],
          ['name', 'course', 'student_group', 'schedule_date', 'from_time', 'to_time', 'room', 'instructor', 'instructor_name'],
          500
        ).catch(() => []);
      }
      // Admin: fetch all, filter by year groups client-side
      return getList('Course Schedule', [],
        ['name', 'course', 'student_group', 'schedule_date', 'from_time', 'to_time', 'room', 'instructor', 'instructor_name'],
        500
      ).catch(() => []);
    },
    staleTime: 30 * 1000,
  });

  // Fetch year's groups for admin client-side filtering
  const { data: yearGroupNames = [] } = useQuery({
    queryKey: ['Schedule', 'yearGroups', selectedYear],
    queryFn: async () => {
      const groups = await getList('Student Group', [['academic_year', '=', selectedYear]], ['name'], 500).catch(() => []);
      return groups.map(g => g.name);
    },
    enabled: !isTeacher && !!selectedYear,
    staleTime: 60 * 1000,
  });

  const { data: programs = [] } = useQuery({
    queryKey: ['Program', 'list-for-schedule'],
    queryFn: () => getList('Program', [], ['name', 'program_name'], 100).catch(() => []),
    staleTime: 5 * 60 * 1000,
  });

  // Build palette map
  const paletteMap = useMemo(() => {
    const map = {};
    let idx = 0;
    schedules.forEach(s => {
      if (s.course && !map[s.course]) map[s.course] = PALETTES[idx++ % PALETTES.length];
    });
    return map;
  }, [schedules]);

  // Filter: admins need year filter, teachers already scoped
  const filtered = schedules.filter(s => {
    const matchY = isTeacher || yearGroupNames.length === 0 || yearGroupNames.includes(s.student_group);
    const matchP = !selectedProgram || s.student_group?.includes(selectedProgram);
    const matchI = !selectedInstructor || (s.instructor_name || s.instructor) === selectedInstructor;
    return matchY && matchP && matchI;
  });

  const instructorNames = [...new Set(filtered.map(s => s.instructor_name || s.instructor).filter(Boolean))];

  // Group by day
  const byDay = {};
  DAYS.forEach(d => { byDay[d] = []; });
  filtered.forEach(s => {
    const d = dayName(s.schedule_date);
    if (byDay[d]) byDay[d].push(s);
  });
  DAYS.forEach(d => byDay[d].sort((a, b) => (a.from_time || '').localeCompare(b.from_time || '')));
  const activeDays = DAYS.filter(d => byDay[d].length > 0);

  const uniqueCourses = [...new Set(filtered.map(s => s.course).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="eyebrow">Academics</div>
          <h1 className="text-3xl font-bold text-[var(--color-text)] -mt-1">Schedule</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">Class timetable and course schedules</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            {[{ k: 'week', icon: '⬛', label: 'Week' }, { k: 'list', icon: '≡', label: 'List' }].map(({ k, icon, label }) => (
              <button key={k} onClick={() => setView(k)}
                className={`px-4 py-2 text-sm font-medium transition-all flex items-center gap-1.5 ${
                  view === k ? 'bg-[var(--color-primary)] text-white shadow-inner' : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}>
                <span className="text-base leading-none">{icon}</span>{label}
              </button>
            ))}
          </div>
          <button onClick={() => setIsAssigning(true)} className="btn-primary text-sm px-4 py-2 flex items-center gap-2 shadow-sm group">
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center transition-all duration-300 group-hover:bg-white/30 group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </span>
            Add Class
          </button>
          <button onClick={refetch}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition shadow-sm group">
            <span className="w-5 h-5 flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:translate-x-0.5 group-hover:-translate-y-[1px]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { emoji: '🗓️', value: filtered.length,         label: 'Total Classes',   color: 'from-[#E8F9ED] to-[#BBF7D0] text-[#2ED05D] border-[#BBF7D0]'     },
          { emoji: '📚', value: uniqueCourses.length,     label: 'Courses Active',  color: 'from-emerald-50 to-green-100 text-emerald-700 border-emerald-200' },
          { emoji: '👩‍🏫', value: instructorNames.length,  label: 'Instructors',    color: 'from-[#BBF7D0] to-[#BBF7D0] text-[#2ED05D] border-[#c4b9ff]' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl p-4 bg-gradient-to-br border ${s.color}`}>
            <div className="text-2xl mb-1">{s.emoji}</div>
            <div className="text-3xl font-bold">{s.value}</div>
            <div className="text-sm font-medium opacity-70 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select value={selectedProgram} onChange={e => setSelectedProgram(e.target.value)} className="input text-sm w-auto min-w-[150px]">
          <option value="">All Programs</option>
          {[...programs]
            .sort((a, b) => {
              const numA = parseInt((a.program_name || a.name).match(/\d+/)?.[0] || 0);
              const numB = parseInt((b.program_name || b.name).match(/\d+/)?.[0] || 0);
              return numA - numB;
            })
            .map(p => <option key={p.name} value={p.name}>{p.program_name || p.name}</option>)
          }
        </select>
        <select value={selectedInstructor} onChange={e => setSelectedInstructor(e.target.value)} className="input text-sm w-auto min-w-[150px]">
          <option value="">All Instructors</option>
          {instructorNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        {(selectedProgram || selectedInstructor) && (
          <button onClick={() => { setSelectedProgram(''); setSelectedInstructor(''); }}
            className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1 transition">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            Clear
          </button>
        )}
        {uniqueCourses.length > 0 && (
          <div className="ml-auto flex flex-wrap gap-2">
            {uniqueCourses.map(c => {
              const pal = paletteMap[c];
              return (
                <span key={c} className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${pal?.badge || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                  <span className={`w-2 h-2 rounded-full ${pal?.dot || 'bg-gray-400'}`} />{c}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-28 gap-3">
          <div className="w-10 h-10 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--color-text-secondary)]">Loading timetable…</p>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onAdd={() => setIsAssigning(true)} />
      ) : view === 'week' ? (
        <WeekView byDay={byDay} activeDays={activeDays} paletteMap={paletteMap} />
      ) : (
        <ListView schedules={filtered} paletteMap={paletteMap} />
      )}

      <AssignClassModal
        isOpen={isAssigning}
        onClose={() => setIsAssigning(false)}
        onSuccess={() => { setIsAssigning(false); refetch(); }}
      />
    </div>
  );
}

function WeekView({ byDay, activeDays, paletteMap }) {
  const cols = activeDays.length || 5;
  return (
    <div className="card !p-0 overflow-hidden">
      <div className="grid border-b border-gray-100" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
        {activeDays.map(day => (
          <div key={day} className={`px-3 py-4 text-center border-r last:border-r-0 border-gray-100 ${byDay[day].length > 0 ? 'bg-[var(--color-primary)]/5' : 'bg-gray-50/50'}`}>
            <p className="font-bold text-sm text-[var(--color-text)]">{day}</p>
            <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${byDay[day].length > 0 ? 'bg-[var(--color-primary)] text-white' : 'bg-gray-200 text-gray-500'}`}>
              {byDay[day].length} {byDay[day].length === 1 ? 'class' : 'classes'}
            </span>
          </div>
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
        {activeDays.map(day => (
          <div key={day} className="p-3 border-r last:border-r-0 border-gray-100 min-h-[200px] space-y-2">
            {byDay[day].length === 0 ? (
              <div className="flex items-center justify-center h-20 text-xs text-gray-300 border border-dashed border-gray-200 rounded-xl">Free day</div>
            ) : byDay[day].map(s => (
              <WeekClassCard key={s.name} s={s} pal={paletteMap[s.course] || PALETTES[0]} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekClassCard({ s, pal }) {
  return (
    <div className={`rounded-xl border p-3 hover:shadow-md hover:-translate-y-0.5 transition-all ${pal.card}`}>
      <p className={`font-semibold text-sm leading-snug ${pal.title}`}>{s.course}</p>
      <p className={`text-xs font-medium mt-1.5 ${pal.time}`}>{fmt(s.from_time)} – {fmt(s.to_time)}</p>
      {s.student_group && <p className="text-xs text-gray-500 mt-1 truncate">📋 {s.student_group}</p>}
      {s.room && <p className="text-xs text-gray-500 truncate">🚪 {s.room}</p>}
      {(s.instructor_name || s.instructor) && (
        <div className="flex items-center gap-1 mt-2">
          <span className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center ${pal.badge}`}>{(s.instructor_name || s.instructor)[0]?.toUpperCase()}</span>
          <span className={`text-xs font-medium ${pal.time}`}>{s.instructor_name || s.instructor}</span>
        </div>
      )}
    </div>
  );
}

function ListView({ schedules, paletteMap }) {
  const byDate = {};
  schedules.forEach(s => {
    const k = s.schedule_date || 'Unknown';
    if (!byDate[k]) byDate[k] = [];
    byDate[k].push(s);
  });
  const sorted = Object.keys(byDate).sort();

  return (
    <div className="space-y-8">
      {sorted.map(date => (
        <div key={date}>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-[var(--color-primary)] text-white shadow-md shrink-0">
              <span className="text-xs font-semibold uppercase leading-none opacity-80">{shortDay(date)}</span>
              <span className="text-xl font-bold leading-tight">{parseDateStr(date)?.getDate()}</span>
            </div>
            <div>
              <p className="font-bold text-[var(--color-text)]">{dayName(date)}</p>
              <p className="text-sm text-[var(--color-text-secondary)]">{niceDate(date)} · {byDate[date].length} class{byDate[date].length !== 1 ? 'es' : ''}</p>
            </div>
            <div className="flex-1 h-px bg-gray-100 ml-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pl-[4.25rem]">
            {byDate[date].sort((a, b) => (a.from_time || '').localeCompare(b.from_time || '')).map(s => {
              const pal = paletteMap[s.course] || PALETTES[0];
              return (
                <div key={s.name} className={`rounded-2xl border p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all ${pal.card}`}>
                  <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full mb-3 ${pal.badge}`}>{fmt(s.from_time)} – {fmt(s.to_time)}</span>
                  <p className={`font-bold text-base ${pal.title}`}>{s.course}</p>
                  <div className="mt-3 space-y-1.5">
                    {s.student_group && <div className="flex items-center gap-1.5 text-xs text-gray-500"><span>📋</span><span className="truncate">{s.student_group}</span></div>}
                    {s.room && <div className="flex items-center gap-1.5 text-xs text-gray-500"><span>🚪</span><span>{s.room}</span></div>}
                    {(s.instructor_name || s.instructor) && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-black/5">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${pal.badge}`}>{(s.instructor_name || s.instructor)[0]?.toUpperCase()}</div>
                        <span className={`text-xs font-semibold ${pal.time}`}>{s.instructor_name || s.instructor}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="card flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-4xl mb-4">🗓️</div>
      <p className="font-bold text-[var(--color-text)] text-lg">No classes scheduled yet</p>
      <p className="text-sm text-[var(--color-text-secondary)] mt-1 max-w-xs">Assign a class to get your schedule started.</p>
      <button onClick={onAdd} className="mt-5 btn-primary text-sm px-5 py-2.5 flex items-center gap-2 group">
        <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center transition-all duration-300 group-hover:bg-white/30 group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        </span>
        Add Class
      </button>
    </div>
  );
}
