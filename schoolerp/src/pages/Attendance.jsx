import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAcademicYear } from '../context/AcademicYearContext';
import { getList, getDoc, createDoc, updateDoc, adminCreateDoc, adminUpdateDoc } from '../api/frappe';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import DatePicker from '../components/DatePicker';

const today = () => new Date().toISOString().split('T')[0];

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

const STATUS_STYLE = {
  Present: { pill: 'bg-emerald-100 text-emerald-700 border-emerald-200', btn: 'bg-emerald-500 text-white shadow-emerald-200', icon: '✓', label: 'Present' },
  Absent:  { pill: 'bg-red-100 text-red-700 border-red-200',             btn: 'bg-red-500 text-white shadow-red-200',         icon: '✗', label: 'Absent' },
  Leave:   { pill: 'bg-amber-100 text-amber-700 border-amber-200',       btn: 'bg-amber-500 text-white shadow-amber-200',     icon: '◷', label: 'Leave' },
};

export default function Attendance() {
  const { user } = useAuth();
  const { selectedYear, isCurrentYear } = useAcademicYear();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isTeacher = user?.roles?.includes('Instructor');

  const [date, setDate]                   = useState(today());
  const [selectedProgram, setSelectedProgram] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [attendance, setAttendance]       = useState({});
  const [existingDocs, setExistingDocs]   = useState({});
  const [saving, setSaving]               = useState(false);
  const [saved, setSaved]                 = useState(false);
  const [saveError, setSaveError]         = useState('');
  const [tab, setTab]                     = useState('mark');
  const [search, setSearch]               = useState('');
  const [summaryRange, setSummaryRange]   = useState('week'); // 'week' | 'month'
  const [hasChanges, setHasChanges]       = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const searchRef                         = useRef(null);

  // ── Warn before leaving with unsaved changes ──
  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasChanges]);

  // ── Keyboard shortcut: Ctrl+S to save ──
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges && students.length > 0) setShowConfirm(true);
      }
      // Focus search with /
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasChanges]);

  // Reset selections when year changes
  useEffect(() => {
    setSelectedProgram('');
    setSelectedGroup('');
    setAttendance({});
    setExistingDocs({});
    setHasChanges(false);
  }, [selectedYear]);

  // ── Data fetching ──

  const { data: programs = [] } = useQuery({
    queryKey: ['Attendance', 'programs'],
    queryFn: () => getList('Program', [], ['name', 'program_name'], 100),
    enabled: !isTeacher,
    select: (data) => data.sort((a, b) => {
      const n = s => parseInt((s.program_name || s.name).match(/\d+/)?.[0] || 0);
      return n(a) - n(b);
    }),
  });

  // Build teacher group names: class_teacher group + subject groups
  const teacherGroupNames = isTeacher
    ? [...new Set([user.myGroupName, ...(user.mySubjectGroups || [])].filter(Boolean))]
    : [];

  const { data: teacherGroups = [] } = useQuery({
    queryKey: ['Attendance', 'teacherGroups', user?.name, selectedYear, ...teacherGroupNames],
    queryFn: () => {
      if (teacherGroupNames.length > 0) {
        const filters = [['name', 'in', teacherGroupNames]];
        if (selectedYear) filters.push(['academic_year', '=', selectedYear]);
        return getList('Student Group', filters, ['name', 'student_group_name', 'program'], 100);
      }
      // Fallback: class_teacher only
      const filters = [['class_teacher', '=', user.name]];
      if (selectedYear) filters.push(['academic_year', '=', selectedYear]);
      return getList('Student Group', filters, ['name', 'student_group_name', 'program'], 1);
    },
    enabled: isTeacher,
  });

  // Auto-select for teachers (useEffect to avoid setState during render)
  useEffect(() => {
    if (isTeacher && teacherGroups.length > 0 && !selectedGroup) {
      const group = teacherGroups[0];
      setSelectedGroup(group.name);
      setSelectedProgram(group.program || '');
    }
  }, [isTeacher, teacherGroups, selectedGroup]);

  const { data: studentGroups = [] } = useQuery({
    queryKey: ['Attendance', 'groups', selectedProgram, selectedYear],
    queryFn: () => {
      const filters = [['program', '=', selectedProgram]];
      if (selectedYear) filters.push(['academic_year', '=', selectedYear]);
      return getList('Student Group', filters, ['name', 'student_group_name', 'class_teacher'], 100);
    },
    enabled: !isTeacher && !!selectedProgram,
  });

  // Auto-select first group for admins (useEffect to avoid setState during render)
  useEffect(() => {
    if (!isTeacher && studentGroups.length > 0 && !selectedGroup) {
      setSelectedGroup(studentGroups[0].name);
    }
  }, [isTeacher, studentGroups, selectedGroup]);

  const { data: studentsData, isLoading: loading } = useQuery({
    queryKey: ['Attendance', 'students', selectedGroup, date],
    queryFn: async () => {
      const [groupDoc, existing] = await Promise.all([
        getDoc('Student Group', selectedGroup),
        getList('Student Attendance',
          [['student_group', '=', selectedGroup], ['date', '=', date]],
          ['name', 'student', 'status'], 500).catch(() => []),
      ]);

      const stuList = (groupDoc.students || []).filter(s => s.active);
      const map = {};
      const docMap = {};
      stuList.forEach(s => { map[s.student] = null; });
      (existing || []).forEach(r => {
        map[r.student] = r.status;
        docMap[r.student] = r.name;
      });

      return { students: stuList, attendanceMap: map, existingDocsMap: docMap };
    },
    enabled: !!selectedGroup,
  });

  const students = studentsData?.students || [];
  const alreadyMarked = studentsData && Object.values(studentsData.attendanceMap).some(v => v != null);

  // Sync attendance state when studentsData loads or group/date changes
  const dataKey = `${selectedGroup}-${date}`;
  const [lastKey, setLastKey] = useState('');
  useEffect(() => {
    if (studentsData && dataKey !== lastKey && students.length > 0) {
      setLastKey(dataKey);
      setAttendance(studentsData.attendanceMap);
      setExistingDocs(studentsData.existingDocsMap);
      setHasChanges(false);
    }
  }, [studentsData, dataKey, lastKey, students.length]);

  // Summary date range
  const summaryDates = (() => {
    const now = new Date();
    const end = now.toISOString().split('T')[0];
    let start;
    if (summaryRange === 'week') {
      const d = new Date(now);
      d.setDate(d.getDate() - 6); // last 7 days including today
      start = d.toISOString().split('T')[0];
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    }
    return { start, end };
  })();

  const { data: summaryRecords = [], isLoading: summaryLoading } = useQuery({
    queryKey: ['Attendance', 'summary', selectedGroup, summaryRange, summaryDates.start, summaryDates.end],
    queryFn: () => getList('Student Attendance',
      [['student_group', '=', selectedGroup], ['date', 'between', [summaryDates.start, summaryDates.end]]],
      ['name', 'student', 'student_name', 'status', 'date'], 1000),
    enabled: tab === 'summary' && !!selectedGroup,
  });

  // ── Actions ──

  const markAll = useCallback((status) => {
    const next = {};
    students.forEach(s => { next[s.student] = status; });
    setAttendance(next);
    setHasChanges(true);
  }, [students]);

  const setStatus = useCallback((studentId, status) => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
    setHasChanges(true);
  }, []);

  const handleQuickMark = useCallback((studentId, status) => {
    // Toggle: if same status, unmark; otherwise set new status
    setAttendance(prev => ({
      ...prev,
      [studentId]: prev[studentId] === status ? null : status
    }));
    setHasChanges(true);
  }, []);

  // Batch save with parallel requests
  const executeSave = async () => {
    if (!selectedGroup) return;
    setSaving(true);
    setSaved(false);
    setSaveError('');
    setShowConfirm(false);

    const toCreate = [];
    const toUpdate = [];

    for (const s of students) {
      const status = attendance[s.student];
      if (!status) continue;

      if (existingDocs[s.student]) {
        toUpdate.push({ name: existingDocs[s.student], status, student: s.student });
      } else {
        toCreate.push({
          student: s.student,
          student_group: selectedGroup,
          date: date,
          status: status,
        });
      }
    }

    let errors = 0;

    try {
      // Parallel batch: all creates in parallel, all updates in parallel
      const [createResults, updateResults] = await Promise.all([
        Promise.allSettled(toCreate.map(async (payload) => {
          try {
            return await createDoc('Student Attendance', payload);
          } catch (err) {
            if (err?.response?.status === 403) {
              return await adminCreateDoc('Student Attendance', payload);
            }
            throw err;
          }
        })),
        Promise.allSettled(toUpdate.map(async ({ name, status }) => {
          try {
            return await updateDoc('Student Attendance', name, { status });
          } catch (err) {
            if (err?.response?.status === 403) {
              return await adminUpdateDoc('Student Attendance', name, { status });
            }
            throw err;
          }
        })),
      ]);

      // Update existing docs map with newly created docs
      const newDocs = { ...existingDocs };
      createResults.forEach((result, i) => {
        if (result.status === 'fulfilled' && result.value) {
          newDocs[toCreate[i].student] = result.value.name;
        } else {
          errors++;
          console.error('Failed to create:', toCreate[i].student, result.reason);
        }
      });
      updateResults.forEach((result, i) => {
        if (result.status !== 'fulfilled') {
          errors++;
          console.error('Failed to update:', toUpdate[i].student, result.reason);
        }
      });

      setExistingDocs(newDocs);

      if (errors === 0) {
        setSaved(true);
        setHasChanges(false);
        setTimeout(() => setSaved(false), 3000);
        queryClient.invalidateQueries({ queryKey: ['Attendance'] });
      } else {
        setSaveError(`${errors} record(s) failed to save. Check console for details.`);
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Computed values ──

  const marked  = students.filter(s => attendance[s.student] != null).length;
  const present = students.filter(s => attendance[s.student] === 'Present').length;
  const absent  = students.filter(s => attendance[s.student] === 'Absent').length;
  const leave   = students.filter(s => attendance[s.student] === 'Leave').length;
  const total   = students.length;
  const unmarked = total - marked;
  const pct     = total > 0 ? Math.round((present / total) * 100) : 0;

  const filteredStudents = students.filter(s =>
    !search || s.student_name?.toLowerCase().includes(search.toLowerCase())
  );

  // Aggregate summary data
  const summaryData = (() => {
    if (!summaryRecords.length) return [];
    const byStudent = {};
    summaryRecords.forEach(r => {
      if (!byStudent[r.student]) {
        byStudent[r.student] = { name: r.student_name || r.student, id: r.student, present: 0, absent: 0, leave: 0, days: {} };
      }
      const s = byStudent[r.student];
      if (r.status === 'Present') s.present++;
      else if (r.status === 'Absent') s.absent++;
      else if (r.status === 'Leave') s.leave++;
      // Track per-day status for mini calendar
      if (r.date) s.days[r.date] = r.status;
    });
    return Object.values(byStudent).map(s => {
      const total = s.present + s.absent + s.leave;
      return { ...s, total, pct: total > 0 ? Math.round((s.present / total) * 100) : 0 };
    }).sort((a, b) => a.pct - b.pct); // worst attendance first
  })();

  const filteredSummary = summaryData.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  const isToday = date === today();

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="eyebrow">Academics</div>
          <h1 className="text-3xl font-bold text-[var(--color-text)] -mt-1">Attendance</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">{fmtDate(date)}</p>
        </div>
        {/* Desktop save button (hidden on mobile where floating button shows) */}
        {tab === 'mark' && selectedGroup && students.length > 0 && (
          <button onClick={() => setShowConfirm(true)} disabled={saving || !hasChanges}
            className={`hidden md:flex btn-primary items-center gap-2 px-5 py-2.5 transition-all group ${saved ? '!bg-emerald-500' : ''} ${!hasChanges ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
            ) : saved ? '✓ Saved!' : 'Save Attendance'}
          </button>
        )}
      </div>

      {/* ── Already marked banner ── */}
      {alreadyMarked && isToday && !hasChanges && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-xs font-bold">✓</span>
          <span className="font-medium">Attendance already marked for today.</span>
          <span className="text-emerald-600">You can still make changes and save again.</span>
        </div>
      )}

      {/* ── Unsaved changes banner ── */}
      {hasChanges && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-xs font-bold">!</span>
          <span className="font-medium">You have unsaved changes.</span>
          <button onClick={() => setShowConfirm(true)} className="text-amber-800 font-bold underline ml-auto">Save now</button>
        </div>
      )}

      {/* ── Error banner ── */}
      {saveError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          ⚠️ {saveError}
        </div>
      )}

      {/* ── Tab bar ── */}
      <div className="flex rounded-xl overflow-hidden border border-gray-200 w-fit shadow-sm">
        {[{ k: 'mark', label: '✏️ Mark Attendance' }, { k: 'summary', label: '📊 Summary' }].map(({ k, label }) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-5 py-2.5 text-sm font-medium transition-all ${
              tab === k ? 'bg-[var(--color-primary)] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-end gap-3">
        {tab === 'mark' && (
          <DatePicker
            label="Date"
            value={date}
            onChange={(d) => { setDate(d); setHasChanges(false); }}
          />
        )}
        {isTeacher && selectedGroup ? (
          teacherGroups.length > 1 ? (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Class</label>
              <select value={selectedGroup} onChange={e => {
                const g = teacherGroups.find(tg => tg.name === e.target.value);
                setSelectedGroup(e.target.value);
                setSelectedProgram(g?.program || '');
                setAttendance({}); setExistingDocs({}); setHasChanges(false);
              }} className="input text-sm min-w-[160px]">
                {teacherGroups.map(g => <option key={g.name} value={g.name}>{g.student_group_name || g.name}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Class</label>
              <div className="input text-sm min-w-[160px] flex items-center bg-gray-50 text-gray-700 font-medium">
                {selectedProgram} — {selectedGroup?.replace(`${selectedProgram} - `, '')}
              </div>
            </div>
          )
        ) : isTeacher ? (
          <div className="text-sm text-gray-500 py-2">
            No classes assigned for {selectedYear || 'this year'}. Contact admin to get assigned.
          </div>
        ) : (
          <>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Program</label>
              <select value={selectedProgram} onChange={e => { setSelectedProgram(e.target.value); setSelectedGroup(''); }}
                className="input text-sm min-w-[140px]">
                <option value="">Select Program</option>
                {programs.map(p => <option key={p.name} value={p.name}>{p.program_name || p.name}</option>)}
              </select>
            </div>
            {studentGroups.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Section</label>
                <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}
                  className="input text-sm min-w-[160px]">
                  {studentGroups.map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
                </select>
              </div>
            )}
          </>
        )}
        {/* Search — always visible when there are students */}
        {((tab === 'mark' && students.length > 0) || tab === 'summary') && (
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input ref={searchRef} type="text" placeholder="Search student… (press /)" value={search}
              onChange={e => setSearch(e.target.value)} className="input pl-9 text-sm w-full" />
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          MARK TAB
          ═══════════════════════════════════════════════════════════════ */}
      {tab === 'mark' && (
        !selectedGroup ? (
          <div className="card flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-3">🏫</div>
            <p className="font-semibold text-[var(--color-text)]">Select a program and section</p>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">Choose from the filters above to start marking attendance</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-[var(--color-text-secondary)]">Loading students…</span>
          </div>
        ) : students.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-3">👤</div>
            <p className="font-semibold text-[var(--color-text)]">No students in this section</p>
          </div>
        ) : (
          <>
            {/* ── Compact stats bar ── */}
            <div className="card !py-3">
              <div className="flex items-center justify-between mb-2 text-sm">
                <div className="flex items-center gap-4">
                  <span className="font-medium text-[var(--color-text)]">{marked}/{total} marked</span>
                  {unmarked > 0 && (
                    <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      {unmarked} remaining
                    </span>
                  )}
                </div>
                <span className="font-bold text-emerald-600">{pct}% present</span>
              </div>
              <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden flex">
                <div className="bg-emerald-400 transition-all duration-500" style={{ width: `${total ? (present/total)*100 : 0}%` }} />
                <div className="bg-red-400 transition-all duration-500"     style={{ width: `${total ? (absent/total)*100  : 0}%` }} />
                <div className="bg-amber-400 transition-all duration-500"   style={{ width: `${total ? (leave/total)*100   : 0}%` }} />
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> {present} Present</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> {absent} Absent</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> {leave} Leave</span>
              </div>
            </div>

            {/* ── Quick actions bar ── */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide mr-1">Quick:</span>
              <button onClick={() => markAll('Present')}
                className="px-4 py-2 rounded-xl text-xs font-bold border bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:shadow-md transition-all">
                ✓ All Present
              </button>
              <button onClick={() => markAll('Absent')}
                className="px-4 py-2 rounded-xl text-xs font-bold border bg-red-50 text-red-700 border-red-200 hover:bg-red-100 hover:shadow-md transition-all">
                ✗ All Absent
              </button>
              <button onClick={() => markAll(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold border bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:shadow-md transition-all">
                Clear All
              </button>
              <span className="text-xs text-gray-400 ml-auto hidden md:inline">
                Tip: Press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-mono">/</kbd> to search, <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-mono">Ctrl+S</kbd> to save
              </span>
            </div>

            {/* ── Student list ── */}
            <div className="card !p-0 overflow-hidden">
              <div className="divide-y divide-gray-50">
                {filteredStudents.map((s, idx) => {
                  const status = attendance[s.student];
                  return (
                    <div key={s.student}
                      className={`flex items-center gap-3 md:gap-4 px-4 md:px-5 py-3 transition-colors ${
                        status ? 'bg-gray-50/40' : ''
                      } hover:bg-gray-50/70`}>
                      {/* Roll number */}
                      <span className="text-xs text-gray-400 w-5 text-right shrink-0 font-medium">
                        {s.group_roll_number || idx + 1}
                      </span>

                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] font-bold text-sm shrink-0">
                        {(s.student_name || '?')[0].toUpperCase()}
                      </div>

                      {/* Name */}
                      <div className="flex-1 min-w-0 cursor-pointer group" onClick={() => navigate(`/students/${s.student}`)}>
                        <p className="font-medium text-[var(--color-text)] text-sm truncate group-hover:text-[var(--color-primary)] transition-colors">{s.student_name}</p>
                        <p className="text-xs text-gray-400 truncate group-hover:text-[var(--color-primary)]/70 transition-colors">{s.student}</p>
                      </div>

                      {/* Status buttons — bigger touch targets */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {['Present', 'Absent', 'Leave'].map(opt => (
                          <button key={opt}
                            onClick={() => handleQuickMark(s.student, opt)}
                            className={`w-11 h-11 md:w-10 md:h-10 rounded-xl text-base font-bold border-2 transition-all active:scale-95 ${
                              status === opt
                                ? `${STATUS_STYLE[opt].btn} shadow-lg scale-105 border-transparent`
                                : 'bg-white border-gray-200 text-gray-300 hover:border-gray-400 hover:text-gray-500'
                            }`}
                            title={STATUS_STYLE[opt].label}>
                            {STATUS_STYLE[opt].icon}
                          </button>
                        ))}
                      </div>

                      {/* Status pill (desktop only) */}
                      {status && (
                        <span className={`hidden lg:inline-block text-xs font-semibold px-2.5 py-1 rounded-full border w-20 text-center shrink-0 ${STATUS_STYLE[status].pill}`}>
                          {status}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Empty search state */}
              {filteredStudents.length === 0 && search && (
                <div className="py-12 text-center">
                  <p className="text-sm text-gray-400">No students matching "{search}"</p>
                </div>
              )}
            </div>
          </>
        )
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SUMMARY TAB — Student-wise attendance patterns
          ═══════════════════════════════════════════════════════════════ */}
      {tab === 'summary' && (
        !selectedGroup ? (
          <div className="card flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-3">📊</div>
            <p className="font-semibold text-[var(--color-text)]">Select a class first</p>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">Choose a program and section to view attendance summary</p>
          </div>
        ) : (
          <>
            {/* Range toggle */}
            <div className="flex items-center gap-3">
              <div className="flex rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                {[{ k: 'week', label: 'This Week' }, { k: 'month', label: 'This Month' }].map(({ k, label }) => (
                  <button key={k} onClick={() => setSummaryRange(k)}
                    className={`px-4 py-2 text-xs font-bold transition-all ${
                      summaryRange === k ? 'bg-[var(--color-primary)] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-gray-400">
                {summaryDates.start} to {summaryDates.end}
              </span>
            </div>

            {summaryLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                <span className="ml-3 text-[var(--color-text-secondary)]">Loading attendance data…</span>
              </div>
            ) : summaryData.length === 0 ? (
              <div className="card flex flex-col items-center justify-center py-20 text-center">
                <div className="text-5xl mb-3">📋</div>
                <p className="font-semibold text-[var(--color-text)]">No attendance records found</p>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">Mark attendance first to see the summary</p>
              </div>
            ) : (
              <>
                {/* Overall stats */}
                <div className="card !py-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-[var(--color-text)]">
                      Class Overview — {summaryRange === 'week' ? 'This Week' : 'This Month'}
                    </h3>
                    <span className="text-xs text-gray-400">{summaryData.length} students</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {(() => {
                      const totalP = summaryData.reduce((s, d) => s + d.present, 0);
                      const totalA = summaryData.reduce((s, d) => s + d.absent, 0);
                      const totalL = summaryData.reduce((s, d) => s + d.leave, 0);
                      const totalAll = totalP + totalA + totalL;
                      return [
                        { label: 'Present', value: totalP, pct: totalAll ? Math.round(totalP/totalAll*100) : 0, color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400' },
                        { label: 'Absent', value: totalA, pct: totalAll ? Math.round(totalA/totalAll*100) : 0, color: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-400' },
                        { label: 'Leave', value: totalL, pct: totalAll ? Math.round(totalL/totalAll*100) : 0, color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
                      ].map(s => (
                        <div key={s.label} className={`rounded-xl border p-3 ${s.color}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                            <span className="text-xs font-medium opacity-70">{s.label}</span>
                          </div>
                          <p className="text-xl font-bold">{s.value}</p>
                          <p className="text-xs opacity-60">{s.pct}%</p>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* Chronic absentees alert */}
                {summaryData.filter(s => s.pct < 50 && s.total > 0).length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-red-500 font-bold text-sm">⚠️ Chronic Absentees</span>
                    </div>
                    <p className="text-xs text-red-600">
                      {summaryData.filter(s => s.pct < 50 && s.total > 0).length} student{summaryData.filter(s => s.pct < 50 && s.total > 0).length > 1 ? 's have' : ' has'} below 50% attendance this {summaryRange}.
                      Consider reaching out to parents.
                    </p>
                  </div>
                )}

                {/* Student list */}
                <div className="card !p-0 overflow-hidden">
                  <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-600">
                      {filteredSummary.length} student{filteredSummary.length !== 1 ? 's' : ''}
                    </span>
                    <span className="text-xs text-gray-400">Sorted by attendance % (lowest first)</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {filteredSummary.map((s, idx) => {
                      const pctColor = s.pct >= 75 ? 'text-emerald-600' : s.pct >= 50 ? 'text-amber-600' : 'text-red-600';
                      const barColor = s.pct >= 75 ? 'bg-emerald-400' : s.pct >= 50 ? 'bg-amber-400' : 'bg-red-400';

                      return (
                        <div key={s.id} className="flex items-center gap-3 md:gap-4 px-4 md:px-5 py-3 hover:bg-gray-50/70 transition-colors">
                          {/* Rank */}
                          <span className="text-xs text-gray-400 w-5 text-right shrink-0 font-medium">{idx + 1}</span>

                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] font-bold text-sm shrink-0">
                            {(s.name || '?')[0].toUpperCase()}
                          </div>

                          {/* Name + stats */}
                          <div className="flex-1 min-w-0 cursor-pointer group" onClick={() => navigate(`/students/${s.id}`)}>
                            <div className="flex items-center justify-between mb-1">
                              <p className="font-medium text-[var(--color-text)] text-sm truncate group-hover:text-[var(--color-primary)] transition-colors">{s.name}</p>
                              <span className={`text-sm font-bold ${pctColor} shrink-0 ml-2`}>{s.pct}%</span>
                            </div>

                            {/* Attendance bar */}
                            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-1.5">
                              <div className={`h-full rounded-full transition-all ${barColor}`}
                                style={{ width: `${s.pct}%` }} />
                            </div>

                            {/* Day breakdown mini badges */}
                            <div className="flex items-center gap-1.5 text-[10px]">
                              <span className="font-medium text-emerald-600">{s.present}P</span>
                              <span className="text-gray-300">·</span>
                              <span className="font-medium text-red-600">{s.absent}A</span>
                              <span className="text-gray-300">·</span>
                              <span className="font-medium text-amber-600">{s.leave}L</span>
                              <span className="text-gray-300">·</span>
                              <span className="text-gray-400">{s.total} days</span>
                            </div>
                          </div>

                          {/* Alert indicator for low attendance */}
                          {s.pct < 50 && s.total > 0 && (
                            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0" title="Low attendance" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Empty search */}
                  {filteredSummary.length === 0 && search && (
                    <div className="py-12 text-center">
                      <p className="text-sm text-gray-400">No students matching "{search}"</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )
      )}

      {/* ═══════════════════════════════════════════════════════════════
          FLOATING SAVE BAR (mobile + always visible during marking)
          ═══════════════════════════════════════════════════════════════ */}
      {tab === 'mark' && selectedGroup && students.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 md:left-[250px] z-40 bg-white/90 backdrop-blur-xl border-t border-gray-200 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />{present}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" />{absent}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />{leave}</span>
                <span className="text-gray-300">|</span>
                <span>{unmarked} left</span>
              </div>
              {hasChanges && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Unsaved changes" />
              )}
            </div>
            <button onClick={() => setShowConfirm(true)} disabled={saving || !hasChanges}
              className={`btn-primary flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${
                saved ? '!bg-emerald-500' : ''
              } ${!hasChanges ? 'opacity-40 cursor-not-allowed' : 'shadow-lg shadow-[var(--color-primary)]/20'}`}>
              {saving ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
              ) : saved ? (
                '✓ Saved!'
              ) : (
                <>Save{unmarked > 0 ? ` (${marked}/${total})` : ''}</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          CONFIRMATION MODAL
          ═══════════════════════════════════════════════════════════════ */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-[var(--color-text)] mb-2">Save Attendance?</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-5">
              {fmtDate(date)}
            </p>

            {/* Summary grid */}
            <div className="grid grid-cols-4 gap-2 mb-5">
              {[
                { label: 'Present', value: present, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                { label: 'Absent', value: absent, color: 'bg-red-50 text-red-700 border-red-200' },
                { label: 'Leave', value: leave, color: 'bg-amber-50 text-amber-700 border-amber-200' },
                { label: 'Unmarked', value: unmarked, color: 'bg-gray-50 text-gray-600 border-gray-200' },
              ].map(s => (
                <div key={s.label} className={`text-center p-3 rounded-xl border ${s.color}`}>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-[10px] font-medium opacity-70">{s.label}</p>
                </div>
              ))}
            </div>

            {unmarked > 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-3 py-2 text-xs mb-5">
                ⚠️ {unmarked} student{unmarked > 1 ? 's' : ''} not marked. They will have no attendance record for this date.
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowConfirm(false)}
                className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                Cancel
              </button>
              <button onClick={executeSave} disabled={saving}
                className="btn-primary px-6 py-2.5 text-sm font-bold flex items-center gap-2">
                {saving ? (
                  <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
                ) : 'Confirm & Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
