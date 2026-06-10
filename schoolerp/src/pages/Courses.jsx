import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAcademicYear } from '../context/AcademicYearContext';
import { getList, client } from '../api/frappe';
import { useSubjects, useCreateSubject } from '../hooks/useSubjects';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const CARD_COLORS = [
  { bg: 'bg-[#E8F9ED]',    border: 'border-[#BBF7D0]',    badge: 'bg-[#BBF7D0] text-[#2ED05D]',      dot: 'bg-blue-400'    },
  { bg: 'bg-violet-50',  border: 'border-violet-200',  badge: 'bg-[#BBF7D0] text-violet-700',  dot: 'bg-violet-400'  },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700',  dot: 'bg-emerald-400' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700',dot: 'bg-emerald-400' },
  { bg: 'bg-rose-50',    border: 'border-rose-200',    badge: 'bg-rose-100 text-rose-700',      dot: 'bg-rose-400'    },
  { bg: 'bg-cyan-50',    border: 'border-cyan-200',    badge: 'bg-cyan-100 text-cyan-700',      dot: 'bg-cyan-400'    },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700',  dot: 'bg-emerald-400' },
  { bg: 'bg-pink-50',    border: 'border-pink-200',    badge: 'bg-pink-100 text-pink-700',      dot: 'bg-pink-400'    },
];

const fmt = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
};

export default function Courses() {
  const { user } = useAuth();
  const { selectedYear } = useAcademicYear();
  const queryClient = useQueryClient();
  const isAdmin = user?.roles?.some(r => r === 'Administrator' || r === 'System Manager' || r === 'Academics User');

  const [search, setSearch]                     = useState('');
  const [filterInstructor, setFilterInstructor] = useState('');
  const [showModal, setShowModal]               = useState(false);
  const [selectedCourse, setSelectedCourse]     = useState(null);
  const [formData, setFormData]                 = useState({ name: '', description: '' });
  const [error, setError]                       = useState('');

  const { data: coursesRaw = [], isLoading: loadingCourses } = useSubjects();

  const { data: schedules = [] } = useQuery({
    queryKey: ['timetable', 'all-for-courses', selectedYear],
    queryFn: async () => {
      const res = await client.get('/timetable/slots', { params: { limit: 500 } });
      let items = res.data;
      if (!Array.isArray(items)) items = items.data || items.results || [];
      return items.map(s => ({
        name: s.id,
        course: s.subject_name || s.subject_id || '',
        instructor_name: s.instructor_name || '',
        instructor: s.instructor_id || '',
        student_group: s.section_id || '',
      }));
    },
    enabled: !!selectedYear,
    staleTime: 60 * 1000,
  });

  const { data: instructors = [] } = useQuery({
    queryKey: ['Instructor', 'list-for-courses'],
    queryFn: () => getList('Instructor', [['status', '=', 'Active']], ['name', 'instructor_name'], 200).catch(() => []),
    staleTime: 2 * 60 * 1000,
  });

  // Enrich courses with instructor and schedule data
  const courseInstructorMap = {};
  const courseScheduleCount = {};
  schedules.forEach((s) => {
    if (!s.course) return;
    if (!courseInstructorMap[s.course]) courseInstructorMap[s.course] = new Set();
    const name = s.instructor_name || s.instructor;
    if (name) courseInstructorMap[s.course].add(name);
    courseScheduleCount[s.course] = (courseScheduleCount[s.course] || 0) + 1;
  });

  const courses = coursesRaw.map((c, idx) => ({
    ...c,
    instructors: courseInstructorMap[c.id] ? Array.from(courseInstructorMap[c.id]) : [],
    scheduleCount: courseScheduleCount[c.id] || 0,
    colorIdx: idx % CARD_COLORS.length,
  }));

  const createMutation = useCreateSubject();

  const filtered = courses.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !search || c.name?.toLowerCase().includes(q) || c.instructors?.some((i) => i.toLowerCase().includes(q));
    const matchInst = !filterInstructor || c.instructors.includes(filterInstructor);
    return matchSearch && matchInst;
  });

  const handleAdd = () => {
    if (!formData.name.trim()) { setError('Course name is required.'); return; }
    setError('');
    createMutation.mutate(
      { name: formData.name.trim(), description: formData.description.trim(), code: '' },
      {
        onSuccess: () => {
          setShowModal(false);
          setFormData({ name: '', description: '' });
        },
        onError: (err) => setError(err.response?.data?.detail || 'Failed to create course.')
      }
    );
  };

  const withInstructors = courses.filter((c) => c.instructors.length > 0).length;
  const totalSchedules = schedules.length;
  const courseSchedules = selectedCourse ? schedules.filter((s) => s.course === selectedCourse.id) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow">Academics</div>
          <h1 className="text-3xl font-bold text-[var(--color-text)] -mt-1">Courses</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">Subjects and curriculum management</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 group">
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center transition-all duration-300 group-hover:bg-white/30 group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </span>
            Add Course
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard emoji="📚" value={courses.length}  label="Total Courses"     color="blue"   />
        <StatCard emoji="👩‍🏫" value={withInstructors} label="With Instructors"  color="purple" />
        <StatCard emoji="🗓️" value={totalSchedules}  label="Scheduled Classes" color="amber"  />
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Search courses or instructors..." value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-9 text-sm" />
          </div>
          <select value={filterInstructor} onChange={(e) => setFilterInstructor(e.target.value)} className="input text-sm w-auto min-w-[160px]">
            <option value="">All Instructors</option>
            {instructors.map((i) => <option key={i.name} value={i.instructor_name || i.name}>{i.instructor_name || i.name}</option>)}
          </select>
          <span className="text-sm text-[var(--color-text-secondary)] ml-auto">{filtered.length} course{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loadingCourses ? (
            [1,2,3,4,5,6].map((i) => (
              <div key={i} className="p-5 rounded-2xl border border-gray-100 animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/2" /><div className="h-3 bg-gray-100 rounded w-3/4" /><div className="h-3 bg-gray-100 rounded w-1/3" />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="col-span-full py-16 text-center text-[var(--color-text-secondary)]">
              <div className="text-5xl mb-3">📭</div>
              {search || filterInstructor ? 'No courses match your filters.' : 'No courses yet. Add your first subject!'}
            </div>
          ) : (
            filtered.map((course) => {
              const col = CARD_COLORS[course.colorIdx];
              return (
                <div key={course.id} onClick={() => setSelectedCourse(course)} className={`p-5 rounded-2xl border ${col.bg} ${col.border} hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${col.dot} mt-0.5 shrink-0`} />
                      <h3 className="font-semibold text-[var(--color-text)] group-hover:underline underline-offset-2">{course.name}</h3>
                    </div>
                    {course.scheduleCount > 0 && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${col.badge}`}>
                        {course.scheduleCount} class{course.scheduleCount !== 1 ? 'es' : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 min-h-[2.5rem] mb-3">{course.description || 'No description provided'}</p>
                  <div className="pt-3 border-t border-black/5">
                    {course.instructors.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {course.instructors.slice(0, 3).map((name, idx) => (
                          <span key={idx} className="flex items-center gap-1 px-2 py-0.5 bg-white/80 rounded-full text-xs font-medium text-gray-700 border border-black/10">
                            <span className="w-4 h-4 rounded-full bg-purple-200 text-[#2ED05D] flex items-center justify-center text-[9px] font-bold">{name[0]?.toUpperCase()}</span>
                            {name}
                          </span>
                        ))}
                        {course.instructors.length > 3 && <span className="px-2 py-0.5 bg-white/80 rounded-full text-xs text-gray-500 border border-black/10">+{course.instructors.length - 3}</span>}
                      </div>
                    ) : <span className="text-xs text-gray-400 italic">No instructor assigned yet</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {selectedCourse && (() => {
        const col = CARD_COLORS[selectedCourse.colorIdx];
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-end" onClick={() => setSelectedCourse(null)}>
            <div className="bg-white h-full w-full max-w-sm shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className={`p-6 ${col.bg} border-b ${col.border}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full mb-2 ${col.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
                      {selectedCourse.scheduleCount} class{selectedCourse.scheduleCount !== 1 ? 'es' : ''} scheduled
                    </span>
                    <h2 className="text-xl font-bold text-[var(--color-text)]">{selectedCourse.name}</h2>
                  </div>
                  <button onClick={() => setSelectedCourse(null)} className="text-gray-400 hover:text-gray-700 mt-1 shrink-0 ml-2 group">
                    <span className="w-5 h-5 rounded-full bg-black/5 flex items-center justify-center group-hover:bg-black/10 transition-all duration-300">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </span>
                  </button>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mt-2">{selectedCourse.description || 'No description provided.'}</p>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <PanelSection title="Instructors" icon="👩‍🏫">
                  {selectedCourse.instructors.length > 0 ? (
                    <div className="space-y-2">
                      {selectedCourse.instructors.map((name, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-[#BBF7D0] rounded-xl border border-purple-100">
                          <div className="w-9 h-9 rounded-full bg-purple-200 flex items-center justify-center text-[#2ED05D] font-bold text-sm shrink-0">{name[0]?.toUpperCase()}</div>
                          <span className="text-sm font-medium text-gray-800">{name}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-gray-400 italic">No instructors yet. Create a Course Schedule in ERPNext to link one.</p>}
                </PanelSection>
                <PanelSection title="Class Schedule" icon="🗓️">
                  {courseSchedules.length > 0 ? (
                    <div className="space-y-2">
                      {courseSchedules.map((s) => (
                        <div key={s.name} className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-sm space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-gray-800">{fmt(s.from_time)} – {fmt(s.to_time)}</span>
                            <span className="text-xs text-gray-400">{s.schedule_date}</span>
                          </div>
                          {s.student_group && <div className="text-xs text-gray-500">📋 {s.student_group}</div>}
                          {s.room && <div className="text-xs text-gray-500">🚪 {s.room}</div>}
                          {(s.instructor_name || s.instructor) && <div className="text-xs text-[#2ED05D] font-medium">👤 {s.instructor_name || s.instructor}</div>}
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-gray-400 italic">No classes scheduled yet.</p>}
                </PanelSection>
              </div>
              <div className="p-4 border-t border-gray-100">
                <a href={`/app/course/${encodeURIComponent(selectedCourse.id)}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  Open in ERPNext
                </a>
              </div>
            </div>
          </div>
        );
      })()}

      {showModal && isAdmin && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-[var(--color-text)]">Add New Course</h2>
              <button onClick={() => { setShowModal(false); setError(''); }} className="text-gray-400 hover:text-gray-600 group">
                <span className="w-6 h-6 rounded-full bg-black/5 flex items-center justify-center group-hover:bg-black/10 transition-all duration-300">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </span>
              </button>
            </div>
            {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Course Name <span className="text-red-500">*</span></label>
                <input className="input w-full" placeholder="e.g. Mathematics" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Description</label>
                <textarea className="input w-full resize-none" rows={3} placeholder="Brief description of the course..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setShowModal(false); setError(''); }} className="flex-1 py-2.5 px-4 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleAdd} disabled={createMutation.isPending} className="flex-1 btn-primary py-2.5 px-4 text-sm disabled:opacity-60">{createMutation.isPending ? 'Saving...' : 'Create Course'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ emoji, value, label, color }) {
  const colors = { blue: 'bg-[#E8F9ED] text-[#2ED05D]', purple: 'bg-[#BBF7D0] text-[#2ED05D]', amber: 'bg-emerald-50 text-emerald-700' };
  return (
    <div className={`rounded-2xl p-4 ${colors[color]}`}>
      <div className="text-2xl mb-1">{emoji}</div>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm font-medium opacity-70 mt-0.5">{label}</div>
    </div>
  );
}

function PanelSection({ title, icon, children }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-1.5"><span>{icon}</span>{title}</h4>
      {children}
    </div>
  );
}
