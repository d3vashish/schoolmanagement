import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAcademicYear } from '../context/AcademicYearContext';
import { getList, client } from '../api/frappe';
import { useQuery } from '@tanstack/react-query';

const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const ICONS = {
  students: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  teachers: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  courses: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  programs: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  check: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  plus: 'M12 4v16m8-8H4',
  arrow: 'M9 5l7 7-7 7',
  users: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  chart: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
};

const gradientKPIs = [
  { key: 'students', label: 'Total Students', gradient: 'linear-gradient(135deg, #8EDFD2, #7ED7C9)', icon: ICONS.students },
  { key: 'instructors', label: 'Total Teachers', gradient: 'linear-gradient(135deg, #F5D98B, #F0CF74)', icon: ICONS.teachers },
  { key: 'attendanceRate', label: 'Attendance Rate', gradient: 'linear-gradient(135deg, #C9A4F5, #B48DEB)', icon: ICONS.check, suffix: '%' },
  { key: 'courses', label: 'Total Courses', gradient: 'linear-gradient(135deg, #F58E92, #EF767B)', icon: ICONS.courses },
  { key: 'feesCollection', label: 'Fees Collected', gradient: 'linear-gradient(135deg, #F7C98C, #F2B870)', icon: ICONS.calendar, suffix: '%' },
];

const TEACHER_GRADIENT_KPIS = [
  { key: 'myClasses', label: 'My Classes', gradient: 'linear-gradient(135deg, #8EDFD2, #7ED7C9)', icon: ICONS.programs },
  { key: 'mySections', label: 'My Sections', gradient: 'linear-gradient(135deg, #C9A4F5, #B48DEB)', icon: ICONS.users },
  { key: 'mySubjects', label: 'My Subjects', gradient: 'linear-gradient(135deg, #F5D98B, #F0CF74)', icon: ICONS.courses },
  { key: 'myAssignments', label: 'Total Assignments', gradient: 'linear-gradient(135deg, #F58E92, #EF767B)', icon: ICONS.check },
];

const CLASS_COLORS = ['#2ED3C5', '#203B70', '#FF8A3D', '#22C55E', '#4F7CFF', '#A855F7', '#F59E0B'];
const SCHEDULE_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];

function GradientKPICard({ label, value, loading, gradient, icon, styleDelay, suffix }) {
  return (
    <div className="kpi-card animate-in"
      style={{ animationDelay: `${styleDelay}ms`, background: gradient }}>
      <div className="blob w-20 h-20 bg-white/10 -top-6 -right-6 animate-float" style={{ animationDelay: `${styleDelay}ms` }} />
      <div className="blob w-12 h-12 bg-white/8 -bottom-3 -left-3 animate-float-delayed" />
      <div className="relative z-10 p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">{label}</span>
          <div className="kpi-icon w-9 h-9 rounded-[14px] bg-white/25 flex items-center justify-center backdrop-blur-sm transition-transform duration-300">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={icon} />
            </svg>
          </div>
        </div>
        <p className={`text-2xl font-bold text-white leading-none ${!loading ? 'animate-pop' : ''}`}
          style={{ animationDelay: `${styleDelay + 150}ms` }}>
          {loading ? <span className="inline-block w-12 h-7 bg-white/20 rounded animate-pulse" />
            : `${value ?? 0}${suffix || ''}`}
        </p>
        <p className="text-[11px] text-white/70 mt-1.5 font-medium">vs last month</p>
      </div>
    </div>
  );
}

function QuickLink({ href, icon, label }) {
  return (
    <a href={href}
      className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border border-[#EAECEF] hover:border-[#2ED05D]/40 hover:bg-[#E8F9ED] hover:translate-x-1 transition-all duration-200 group shadow-sm">
      <div className="w-8 h-8 rounded-xl bg-[#E8F9ED] flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110">
        <svg className="w-4 h-4 text-[#2ED05D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
        </svg>
      </div>
      <span className="text-sm font-semibold text-[#475569] group-hover:text-[#2ED05D] transition-colors">{label}</span>
      <svg className="w-3.5 h-3.5 text-[#CBD5E1] ml-auto group-hover:text-[#2ED05D] group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ICONS.arrow} />
      </svg>
    </a>
  );
}

const fetchAdminData = async ({ yearStartDate, yearEndDate } = {}) => {
  const attFilters = [];
  if (yearStartDate) attFilters.push(['date', '>=', yearStartDate]);
  if (yearEndDate) attFilters.push(['date', '<=', yearEndDate]);

  const today = new Date().toISOString().split('T')[0];

  const [programs, courses, students, instructors, attendanceList, todaySlots] = await Promise.all([
    getList('Program', [], ['name'], 100),
    getList('Course', [], ['name'], 100),
    getList('Student', [['enabled', '=', 1]], ['name', 'student_name', 'first_name', 'creation', 'student_group_name'], 500),
    getList('Instructor', [], ['name'], 100),
    getList('Student Attendance', attFilters, ['name', 'status', 'date', 'creation', 'student_group'], 500),
    client.get('/timetable/slots').then(res => {
      let items = res.data;
      if (!Array.isArray(items)) items = items.data || items.results || [];
      return items.map(s => ({
        name: s.id,
        course: s.subject_name || s.subject_id || '',
        instructor_name: s.instructor_name || '',
        from_time: s.period_no ? `${String(s.period_no + 7).padStart(2, '0')}:00:00` : '',
        to_time: s.period_no ? `${String(s.period_no + 8).padStart(2, '0')}:00:00` : '',
        room: '',
        student_group: s.section_id || '',
      }));
    }).catch(() => []),
  ]);

  const stats = {
    students: Array.isArray(students) ? students.length : 0,
    programs: Array.isArray(programs) ? programs.length : 0,
    courses: Array.isArray(courses) ? courses.length : 0,
    instructors: Array.isArray(instructors) ? instructors.length : 0,
  };

  const attendanceData = [];
  if (Array.isArray(attendanceList) && attendanceList.length > 0) {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const day = d.toLocaleDateString('en-US', { weekday: 'short' });
      const records = attendanceList.filter(a => (a.attendance_date || a.date) === dateStr);
      const present = records.filter(a => a.status === 'Present').length;
      const total = records.length;
      attendanceData.push({ day, rate: total > 0 ? Math.round((present / total) * 100) : 0, total });
    }
  }

  const attendanceRate = attendanceData.length > 0
    ? Math.round(attendanceData.reduce((s, d) => s + d.rate, 0) / attendanceData.length)
    : 0;

  const recentActivity = Array.isArray(students) && students.length > 0
    ? [...students]
        .filter(s => s.creation)
        .sort((a, b) => new Date(b.creation) - new Date(a.creation))
        .slice(0, 4)
        .map(s => ({
          id: s.name,
          name: s.student_name || s.first_name || s.name,
          time: new Date(s.creation).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        }))
    : [];

  const studentsByClass = {};
  if (Array.isArray(students)) {
    students.forEach(s => {
      const cls = s.student_group_name || 'Unassigned';
      studentsByClass[cls] = (studentsByClass[cls] || 0) + 1;
    });
  }
  const classDistribution = Object.entries(studentsByClass)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const courseNames = {};
  const courseIds = [...new Set((todaySchedules || []).map(s => s.course).filter(Boolean))];
  if (courseIds.length > 0) {
    const courseDocs = await getList('Course', [['name', 'in', courseIds]], ['name', 'course_name'], courseIds.length);
    courseDocs.forEach(c => { courseNames[c.name] = c.course_name || c.name; });
  }

  return { stats, attendanceData, attendanceRate, recentActivity, classDistribution, todaySchedules: todaySchedules || [], courseNames };
};

const fetchTeacherData = async () => {
  try {
    const res = await client.get('/academic/my-teaching-profile');
    return res.data;
  } catch {
    return { assignments: [], summary: { total_classes: 0, total_sections: 0, total_subjects: 0, total_assignments: 0 } };
  }
};

export default function Dashboard() {
  const { user } = useAuth();
  const { selectedYear, yearStartDate, yearEndDate } = useAcademicYear();

  if (user?.role === 'parent') return <Navigate to="/parent" replace />;

  const isTeacher = user?.roles?.includes('teacher');
  const isStudent = user?.roles?.includes('student');
  const isParent = user?.roles?.includes('parent');

  const { data: adminData, isLoading: adminLoading, refetch: refetchAdmin } = useQuery({
    queryKey: ['Dashboard', 'admin', selectedYear],
    queryFn: () => fetchAdminData({ yearStartDate, yearEndDate }),
    enabled: !isTeacher && !isStudent && !isParent,
  });

  const { data: teacherData, isLoading: teacherLoading, refetch: refetchTeacher } = useQuery({
    queryKey: ['Dashboard', 'teacher', user?.email],
    queryFn: fetchTeacherData,
    enabled: isTeacher,
  });

  const { data: studentData, isLoading: studentLoading } = useQuery({
    queryKey: ['Dashboard', 'student', selectedYear],
    queryFn: async () => {
      const [hwResult, slotsResult, attResult, feeResult] = await Promise.allSettled([
        getList('Homework Assignment', { limit: 10 }),
        client.get('/timetable/slots').then(r => {
          let items = r.data;
          if (!Array.isArray(items)) items = items.data || items.results || [];
          return items.map(s => ({
            name: s.id,
            day: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][s.day_of_week] || '',
            from_time: s.period_no ? `${String(s.period_no + 7).padStart(2, '0')}:00:00` : '',
            subject: s.subject_name || '',
          }));
        }),
        getList('Student Attendance', { limit: 30 }),
        getList('Fees', { limit: 10 }),
      ]);
      const homework = hwResult.status === 'fulfilled' ? (hwResult.value || []) : [];
      const slots = slotsResult.status === 'fulfilled' ? (slotsResult.value || []) : [];
      const attRecords = attResult.status === 'fulfilled' ? (attResult.value || []) : [];
      const fees = feeResult.status === 'fulfilled' ? (feeResult.value || []) : [];
      const todayName = new Date().toLocaleDateString('en', { weekday: 'long' });
      const todaySlots = slots.filter(s => s.day === todayName);
      const present = attRecords.filter(a => a.status === 'Present').length;
      const attendanceRate = attRecords.length > 0 ? Math.round((present / attRecords.length) * 100) : 0;
      const pendingHomework = homework.filter(h => h.status === 'Published' || h.status === 'Pending').length;
      const outstandingFees = fees.filter(f => f.outstanding_amount > 0).length;
      return { homework, todaySlots, attendanceRate, pendingHomework, outstandingFees };
    },
    enabled: isStudent,
  });

  const { data: parentData, isLoading: parentLoading } = useQuery({
    queryKey: ['Dashboard', 'parent', selectedYear],
    queryFn: async () => {
      const childrenResult = await getList('Program Enrollment', [], ['student', 'student_name'], 50);
      if (!childrenResult || childrenResult.length === 0) return { childrenData: [] };
      const childrenData = await Promise.all(childrenResult.map(async (link) => {
        const [hwRes, attRes, feeRes] = await Promise.allSettled([
          getList('Homework Assignment', { filters: [['student_group', '=', link.student_group || '']] }),
          getList('Student Attendance', { filters: [['student', '=', link.student]] }),
          getList('Fees', { filters: [['student', '=', link.student]] }),
        ]);
        const attRecords = attRes.status === 'fulfilled' ? (attRes.value || []) : [];
        const present = attRecords.filter(a => a.status === 'Present').length;
        const attPct = attRecords.length > 0 ? Math.round((present / attRecords.length) * 100) : 0;
        return {
          id: link.student,
          name: link.student_name || link.student,
          class: link.student_group || '',
          section: '',
          attendance: attPct,
          pendingHomework: hwRes.status === 'fulfilled' ? (hwRes.value || []).length : 0,
          outstandingFees: feeRes.status === 'fulfilled' ? (feeRes.value || []).filter(f => f.outstanding_amount > 0).length : 0,
        };
      }));
      return { childrenData };
    },
    enabled: isParent,
  });

  const loading = isTeacher ? teacherLoading : isStudent ? studentLoading : isParent ? parentLoading : adminLoading;

  const stats = adminData?.stats || { students: 0, programs: 0, courses: 0, instructors: 0 };
  const attendanceData = adminData?.attendanceData || [];
  const attendanceRate = adminData?.attendanceRate || 0;
  const recentActivity = adminData?.recentActivity || [];
  const classDistribution = adminData?.classDistribution || [];
  const teacherProfile = teacherData || { assignments: [], summary: {} };
  const teacherStats = {
    myClasses: teacherProfile.summary?.total_classes || 0,
    mySections: teacherProfile.summary?.total_sections || 0,
    mySubjects: teacherProfile.summary?.total_subjects || 0,
    myAssignments: teacherProfile.summary?.total_assignments || 0,
  };
  const todaySchedule = adminData?.todaySchedules || [];
  const courseNames = adminData?.courseNames || {};

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = user?.full_name?.split(' ')[0] || user?.usr || 'there';

  const overallAttendance = attendanceData.length > 0
    ? Math.round(attendanceData.reduce((s, d) => s + d.rate, 0) / attendanceData.length)
    : 0;

  const maxRate = Math.max(...attendanceData.map(d => d.rate), 1);

  const adminKPIValues = { ...stats, attendanceRate, feesCollection: 78 };

  const tasks = [
    { label: 'Fee Collection Progress', value: '78%', progress: 78, color: '#2ED05D' },
    { label: 'Attendance This Week', value: `${overallAttendance}%`, progress: overallAttendance, color: '#4F7CFF' },
    { label: 'Student Records', value: `${stats.students > 0 ? 100 : 0}%`, progress: stats.students > 0 ? 100 : 0, color: '#FF8A3D' },
  ];

  const totalClassStudents = classDistribution.reduce((s, [, v]) => s + v, 0);

  return (
    <div className="space-y-6">
      <div className="relative flex items-center justify-between animate-in" style={{ animationDelay: '0ms' }}>
        <div className="relative">
          <div className="absolute -top-2 -left-4 w-8 h-8 rounded-full bg-[#FFD93D]/25 animate-float" />
          <div className="absolute -bottom-1 left-8 w-5 h-5 rounded-full bg-[#FF6B9D]/20 animate-float-delayed" />
          <div className="absolute -top-1 left-16 w-4 h-4 rounded-full bg-[#6BCB77]/25 animate-float" style={{ animationDelay: '-0.8s' }} />
          <h1 className="text-xl font-bold text-[#1F2A44] relative">{getGreeting()}, {firstName} <span className="inline-block animate-wiggle" style={{ transformOrigin: 'bottom right' }}>👋</span></h1>
          <p className="text-sm text-[#475569] mt-0.5">Let's make today a great day at school!</p>
        </div>
        <button onClick={() => isTeacher ? refetchTeacher() : refetchAdmin()}
          className="btn-primary px-5 py-2.5 text-xs flex items-center gap-2.5 hover:shadow-[0_4px_16px_rgba(46,208,93,0.30)] hover:-translate-y-0.5 active:scale-[0.96] cursor-pointer group">
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
            <svg className={`w-3 h-3 text-white transition-all duration-500 ${loading ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </span>
          Refresh
        </button>
      </div>

      {isStudent ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <GradientKPICard label="Attendance" value={studentData?.attendanceRate ?? 0} loading={loading} gradient="linear-gradient(135deg, #C9A4F5, #B48DEB)" icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" styleDelay={60} suffix="%" />
            <GradientKPICard label="Pending Homework" value={studentData?.pendingHomework ?? 0} loading={loading} gradient="linear-gradient(135deg, #F5D98B, #F0CF74)" icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" styleDelay={110} />
            <GradientKPICard label="Periods Today" value={studentData?.todaySlots?.length ?? 0} loading={loading} gradient="linear-gradient(135deg, #F58E92, #EF767B)" icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" styleDelay={160} />
            <GradientKPICard label="Outstanding Fees" value={studentData?.outstandingFees ?? 0} loading={loading} gradient="linear-gradient(135deg, #F7C98C, #F2B870)" icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" styleDelay={210} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="card animate-in" style={{ animationDelay: '120ms' }}>
              <h2 className="text-sm font-bold text-[#1F2A44] mb-4">Today's Schedule</h2>
              {studentData?.todaySlots?.length > 0 ? (
                <div className="space-y-2.5">
                  {studentData.todaySlots.map((slot, i) => {
                    const color = SCHEDULE_COLORS[i % SCHEDULE_COLORS.length];
                    return (
                      <div key={slot.name || i} className="flex items-center gap-4 px-4 py-3 rounded-2xl" style={{ backgroundColor: hexToRgba(color, 0.06) }}>
                        <div className="w-1.5 h-10 rounded-full" style={{ background: color }} />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-[#1F2A44]">{slot.course || '—'}</p>
                          <p className="text-xs text-[#475569]">{slot.instructor_name || ''}</p>
                        </div>
                        <span className="text-xs text-[#94A3B8]">Period {slot.period_no || slot.period}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-[#475569] py-6 text-center">No classes scheduled today</p>
              )}
            </div>

            <div className="card animate-in" style={{ animationDelay: '160ms' }}>
              <h2 className="text-sm font-bold text-[#1F2A44] mb-4">Upcoming Homework</h2>
              {studentData?.homework?.length > 0 ? (
                <div className="space-y-2.5">
                  {studentData.homework.slice(0, 5).map((hw, i) => (
                    <div key={hw.name || i} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50">
                      <div>
                        <p className="text-sm font-semibold text-[#1F2A44]">{hw.title}</p>
                        <p className="text-xs text-[#475569]">{hw.course_name} · Due: {hw.due_date}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${hw.status === 'Published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{hw.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#475569] py-6 text-center">No homework assigned yet</p>
              )}
            </div>
          </div>
        </div>
      ) : isParent ? (
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-[#1F2A44]">My Children</h2>
          {parentData?.childrenData?.length > 0 ? (
            <div className="grid grid-cols-1 gap-5">
              {parentData.childrenData.map(child => (
                <div key={child.id} className="card animate-in" style={{ animationDelay: '60ms' }}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-[#1F2A44]">{child.name}</h3>
                    <span className="text-xs text-[#475569]">{child.class}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-xl">
                      <div className="text-xl font-bold text-blue-600">{child.attendance}%</div>
                      <div className="text-xs text-gray-500">Attendance</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-xl">
                      <div className="text-xl font-bold text-green-600">{child.pendingHomework}</div>
                      <div className="text-xs text-gray-500">Homework</div>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-xl">
                      <div className="text-xl font-bold text-orange-600">{child.outstandingFees}</div>
                      <div className="text-xs text-gray-500">Fees Due</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card text-center py-16">
              <p className="text-sm text-[#475569]">No children linked to your account</p>
            </div>
          )}
        </div>
      ) : isTeacher ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {TEACHER_GRADIENT_KPIS.map((c, i) => (
              <GradientKPICard key={c.key} label={c.label} value={teacherStats[c.key]} loading={loading} gradient={c.gradient} icon={c.icon} styleDelay={60 + i * 50} suffix={c.suffix} />
            ))}
          </div>

          {/* My Teaching Assignments */}
          <div className="card animate-in relative" style={{ animationDelay: '120ms' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-[#1F2A44]">My Teaching Assignments</h2>
                <p className="text-xs text-[#475569] mt-0.5">Classes, sections, and subjects assigned to you</p>
              </div>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-gray-50 animate-pulse" />)}
              </div>
            ) : teacherProfile.assignments.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-[#E8F9ED] flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-[#2ED05D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={ICONS.users} />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-[#1F2A44] mb-1">No assignments yet 📚</h3>
                <p className="text-sm text-[#475569]">Contact your principal to get assigned to classes.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Class</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Section</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Subject</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teacherProfile.assignments.map((a, i) => {
                      const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];
                      const color = colors[(a.class_order || i) % colors.length];
                      return (
                        <tr key={a.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: color }}>
                                {a.class_name?.substring(0, 2)}
                              </div>
                              <span className="text-sm font-medium text-[#1F2A44]">Class {a.class_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold">
                              Section {a.section_name}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-[#1F2A44] font-medium">{a.subject_name}</span>
                            <span className="text-xs text-[#94A3B8] ml-1.5">({a.subject_code})</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick Actions for Teacher */}
          <div className="card animate-in relative" style={{ animationDelay: '180ms' }}>
            <h2 className="text-sm font-bold text-[#1F2A44] mb-3">Quick Actions</h2>
            <div className="flex flex-wrap gap-2">
              <QuickLink href="/attendance" label="Mark Attendance" icon={ICONS.check} />
              <QuickLink href="/homework" label="Create Homework" icon="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              <QuickLink href="/timetable" label="View Timetable" icon={ICONS.calendar} />
              <QuickLink href="/classes" label="View Curriculum" icon={ICONS.programs} />
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Gradient KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-5">
            {gradientKPIs.map((c, i) => (
              <GradientKPICard key={c.key} label={c.label} value={adminKPIValues[c.key]} loading={loading} gradient={c.gradient} icon={c.icon} styleDelay={60 + i * 40} suffix={c.suffix} />
            ))}
          </div>

          {/* Attendance Analytics + Pending Tasks */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 card animate-in relative" style={{ animationDelay: '140ms' }}>
              <div className="absolute -top-1 left-8 w-3 h-3 rounded-full bg-[#4D96FF]/25 animate-float" />
              <div className="absolute bottom-4 right-4 w-4 h-4 rounded-full bg-[#FFD93D]/20 animate-float-delayed" />
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-sm font-bold text-[#1F2A44]">Attendance Analytics</h2>
                  <p className="text-xs text-[#475569] mt-0.5">Last 7 days</p>
                </div>
                <span className="px-3 py-1 rounded-[999px] bg-[#E8F9ED] text-[#2ED05D] text-[10px] font-bold">This Week</span>
              </div>
              {loading ? (
                <div className="h-32 rounded-xl bg-gray-50 animate-pulse" />
              ) : attendanceData.length === 0 ? (
                <div className="h-32 flex flex-col items-center justify-center text-sm text-[#475569]">
                  No attendance data
                </div>
              ) : (
                <div className="flex items-end gap-3 h-32">
                  {attendanceData.map((d, i) => {
                    const barColor = d.rate >= 75 ? '#2ED3C5' : d.rate >= 50 ? '#FF8A3D' : '#EF4444';
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1.5 animate-in" style={{ animationDelay: `${180 + i * 40}ms` }}>
                        <span className="text-[9px] font-semibold text-[#475569]">{d.rate}%</span>
                        <div className="attendance-bar" style={{ height: `${Math.max((d.rate / maxRate) * 96, 4)}%`, background: `linear-gradient(180deg, ${barColor}, ${barColor}88)`, opacity: 0.85, borderRadius: '6px 6px 3px 3px' }} />
                        <span className="text-[9.5px] text-[#475569]">{d.day}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="card animate-in relative" style={{ animationDelay: '160ms' }}>
              <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#FF6B9D]/35 animate-pulse-soft" />
              <div className="absolute -bottom-1 -left-1 w-3 h-3 rounded-full bg-[#FFD93D]/30 animate-pulse-soft" style={{ animationDelay: '-0.7s' }} />
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-[#1F2A44]">Pending Tasks</h2>
              </div>
              <div className="space-y-5">
                {tasks.map((t, i) => (
                  <div key={i} className="animate-in" style={{ animationDelay: `${200 + i * 50}ms` }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-[#475569]">{t.label}</span>
                      <span className="text-xs font-bold" style={{ color: t.color }}>{t.value}</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-bar-fill" style={{ width: `${t.progress}%`, background: `linear-gradient(90deg, ${t.color}, ${t.color}88)` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Students by Class + Recent Activity + Today's Schedule */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            {/* Students by Class (Donut) */}
            <div className="card animate-in relative" style={{ animationDelay: '180ms' }}>
              <div className="absolute -top-1 left-1/3 w-3 h-3 rounded-full bg-[#C084FC]/30 animate-float" />
              <h2 className="text-sm font-bold text-[#1F2A44] mb-4">Students by Class</h2>
              {classDistribution.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-sm text-[#475569]">No class data</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <svg width="120" height="120" viewBox="0 0 120 120" className="mb-3">
                    {classDistribution.map(([, count], i) => {
                      const pct = count / totalClassStudents;
                      const circumference = 2 * Math.PI * 50;
                      const offset = classDistribution.slice(0, i).reduce((s, [, v]) => s + (v / totalClassStudents) * circumference, 0);
                      const length = pct * circumference;
                      return (
                        <circle key={i} cx="60" cy="60" r="50" fill="none"
                          stroke={CLASS_COLORS[i % CLASS_COLORS.length]}
                          strokeWidth="16"
                          strokeDasharray={`${length} ${circumference - length}`}
                          strokeDashoffset={-offset}
                          transform="rotate(-90 60 60)"
                          style={{ transition: 'all 0.3s ease' }} />
                      );
                    })}
                    <text x="60" y="60" textAnchor="middle" dominantBaseline="central"
                      className="text-xs font-bold" fill="#1F2A44">
                      {totalClassStudents}
                    </text>
                  </svg>
                  <div className="w-full space-y-1.5 mt-1">
                    {classDistribution.slice(0, 5).map(([name, count], i) => (
                      <div key={name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: CLASS_COLORS[i % CLASS_COLORS.length] }} />
                          <span className="text-[#475569] truncate max-w-[100px]">{name}</span>
                        </div>
                        <span className="font-semibold text-[#1F2A44]">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Recent Admissions */}
            <div className="card animate-in relative" style={{ animationDelay: '200ms' }}>
              <div className="absolute -bottom-1 right-3 w-3 h-3 rounded-full bg-[#6BCB77]/30 animate-float" />
              <h2 className="text-sm font-bold text-[#1F2A44] mb-4">Recent Admissions</h2>
              {loading ? (
                <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-12 rounded-xl bg-gray-50 animate-pulse" />)}</div>
              ) : recentActivity.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-sm text-[#475569]">No recent enrollments</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recentActivity.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all duration-200 hover:bg-[#E8F9ED]">
                      <div className="w-8 h-8 rounded-[10px] bg-[#E8F9ED] flex items-center justify-center text-xs font-bold text-[#2ED05D] flex-shrink-0">
                        {item.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#1F2A44] truncate">{item.name}</p>
                        <p className="text-[10px] text-[#2ED05D] font-medium">{item.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Today's Schedule */}
            <div className="lg:col-span-2 card animate-in relative" style={{ animationDelay: '220ms' }}>
              <div className="absolute -top-1.5 right-12 w-3 h-3 rounded-full bg-[#FB923C]/30 animate-float" style={{ animationDelay: '-0.3s' }} />
              <div className="absolute -bottom-1 right-1/3 w-4 h-4 rounded-full bg-[#C084FC]/20 animate-float-delayed" />
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-[#1F2A44]">Today's Schedule</h2>
                  <p className="text-xs text-[#475569] mt-0.5">Upcoming classes</p>
                </div>
                <a href="/timetable" className="text-xs font-semibold text-[#2ED05D] hover:text-[#25B04E] transition-colors">View all →</a>
              </div>
              {todaySchedule.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-sm text-[#475569]">No classes scheduled today</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {[...todaySchedule]
                    .sort((a, b) => (a.from_time || '').localeCompare(b.from_time || ''))
                    .map((item, i) => {
                      const timeStr = item.from_time ? item.from_time.substring(0, 5) : '';
                      const endTime = item.to_time ? item.to_time.substring(0, 5) : '';
                      const courseName = courseNames[item.course] || item.course || '—';
                      const initial = courseName[0].toUpperCase();
                      const color = SCHEDULE_COLORS[i % SCHEDULE_COLORS.length];
                      return (
                        <div key={item.name || i} className="flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 animate-in hover:translate-x-1"
                          style={{ animationDelay: `${260 + i * 40}ms`, backgroundColor: hexToRgba(color, 0.06) }}>
                          <div className="flex items-center gap-3 min-w-[72px]">
                            <div className="w-1.5 h-10 rounded-full" style={{ background: color }} />
                            <div>
                              <p className="text-xs font-bold leading-none" style={{ color }}>{timeStr}</p>
                              <p className="text-[10px] text-[#94A3B8] mt-0.5">{endTime}</p>
                            </div>
                          </div>
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: color }}>{initial}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[#1F2A44]">{courseName}</p>
                            <p className="text-xs text-[#475569]">{item.instructor_name || item.student_group || ''}</p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card animate-in relative" style={{ animationDelay: '240ms' }}>
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#6BCB77]/30 animate-float" />
            <div className="absolute -bottom-1 left-1/2 w-3 h-3 rounded-full bg-[#FB923C]/25 animate-float-delayed" />
            <h2 className="text-sm font-bold text-[#1F2A44] mb-3">Quick Actions</h2>
            <div className="flex flex-wrap gap-2">
              <QuickLink href="/students" label="Add Student" icon={ICONS.plus} />
              <QuickLink href="/attendance" label="Mark Attendance" icon={ICONS.check} />
              <QuickLink href="/fees" label="Collect Fees" icon={ICONS.calendar} />
              <QuickLink href="/timetable" label="View Timetable" icon={ICONS.calendar} />
            </div>
          </div>

          {/* Fun Tip */}
          <div className="card animate-in relative flex items-center gap-4 py-3 px-5" style={{ animationDelay: '260ms', background: 'linear-gradient(135deg, #FFF5F5, #FFF8E8)' }}>
            <div className="absolute -top-1.5 left-6 w-4 h-4 rounded-full bg-[#FF6B9D]/25 animate-pulse-soft" />
            <div className="text-xl" style={{ animation: 'float 3s ease-in-out infinite' }}>💡</div>
            <div>
              <p className="text-[11px] font-bold text-[#FF6B9D] uppercase tracking-wide">Did you know?</p>
              <p className="text-sm text-[#475569] font-medium">{['A positive school culture boosts student performance by up to 29%.', 'Students who feel connected to school are 3x more likely to attend regularly.', 'Daily attendance tracking can improve overall rates by 15% in one term.', 'Schools with engaged parents see 40% fewer discipline issues.'][Math.floor(Math.random() * 4)]}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
