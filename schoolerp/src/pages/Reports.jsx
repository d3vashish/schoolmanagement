import { useState, useMemo } from 'react';
import {
  BarChart2, TrendingUp, Users, Award,
  AlertCircle, RefreshCw, LogOut, ChevronDown,
  Loader2, Download, Search, Filter,
  CheckCircle2, Clock, XCircle, Eye
} from 'lucide-react';
import {
  isConnected, initiateGoogleAuth, clearToken, untagTitle, getCourseworkTag
} from '../api/googleClassroom';
import { useGCCourses, useGCGradeMatrix, useGCStudents } from '../hooks/useGoogleClassroom';
import { useAuth } from '../context/AuthContext';

function useCanManage() {
  const { user } = useAuth();
  const roles = user?.roles || [];
  return roles.includes('Administrator') || roles.includes('Instructor') || roles.includes('Academics User');
}

// ─── Mini Stat Card ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = 'blue', icon: Icon }) {
  const colors = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium opacity-70">{label}</p>
        {Icon && <Icon size={14} className="opacity-60" />}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Inline Bar Chart ─────────────────────────────────────────────────────────

function ScoreBar({ score, max, color = '#3b82f6' }) {
  if (!max || score == null) return <span className="text-xs text-[var(--color-text-secondary)]">—</span>;
  const pct = Math.min((score / max) * 100, 100);
  const grade = pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : pct >= 50 ? 'D' : 'F';
  const barColor = pct >= 80 ? '#22c55e' : pct >= 60 ? '#3b82f6' : pct >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
      <span className="text-xs text-[var(--color-text-secondary)] w-8">{score}/{max}</span>
      <span className="text-xs font-semibold" style={{ color: barColor }}>{grade}</span>
    </div>
  );
}

// ─── State Badge ──────────────────────────────────────────────────────────────

function StateBadge({ state }) {
  if (!state || state === 'NEW') return <span className="text-xs text-[var(--color-text-secondary)]">Not started</span>;
  if (state === 'CREATED') return <span className="text-xs text-[var(--color-text-secondary)]">Assigned</span>;
  if (state === 'TURNED_IN') return (
    <span className="inline-flex items-center gap-1 text-xs text-blue-600">
      <Clock size={10} /> Submitted
    </span>
  );
  if (state === 'RETURNED') return (
    <span className="inline-flex items-center gap-1 text-xs text-green-600">
      <CheckCircle2 size={10} /> Graded
    </span>
  );
  if (state === 'RECLAIMED_BY_STUDENT') return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-600">
      <XCircle size={10} /> Reclaimed
    </span>
  );
  return <span className="text-xs">{state}</span>;
}

// ─── Grade Table ──────────────────────────────────────────────────────────────

function GradeTable({ matrix, filter }) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name'); // 'name' | 'avg'

  const { students, assignments, grades } = matrix;

  const filtered = useMemo(() => {
    let s = students;
    if (search) {
      s = s.filter(st => {
        const name = st.profile?.name?.fullName || st.userId;
        return name.toLowerCase().includes(search.toLowerCase());
      });
    }
    // filter by type
    const filteredAssignments = filter === 'ALL'
      ? assignments
      : assignments.filter(a => getCourseworkTag(`[${filter}] `) === filter || a.tag === filter);

    return { students: s, assignments: filteredAssignments };
  }, [students, assignments, grades, search, filter]);

  // Compute per-student averages
  const studentStats = useMemo(() => {
    return filtered.students.map(st => {
      const sid = st.userId;
      let total = 0, earned = 0, graded = 0, submitted = 0;
      for (const a of filtered.assignments) {
        const g = grades[sid]?.[a.id];
        if (g) {
          if (g.state === 'TURNED_IN' || g.state === 'RETURNED') submitted++;
          if (g.score != null && a.maxPoints) {
            earned += g.score;
            total += a.maxPoints;
            graded++;
          }
        }
      }
      const avg = total > 0 ? Math.round((earned / total) * 100) : null;
      return { ...st, avg, submitted, graded, earned, total };
    });
  }, [filtered, grades]);

  const sorted = [...studentStats].sort((a, b) => {
    if (sortBy === 'avg') return (b.avg ?? -1) - (a.avg ?? -1);
    const na = a.profile?.name?.fullName || a.userId;
    const nb = b.profile?.name?.fullName || b.userId;
    return na.localeCompare(nb);
  });

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search students…"
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
          />
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          className="px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm focus:outline-none transition">
          <option value="name">Sort: Name</option>
          <option value="avg">Sort: Average</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
              <th className="text-left px-4 py-3 font-semibold text-[var(--color-text-secondary)] text-xs uppercase tracking-wide w-48">Student</th>
              <th className="text-center px-3 py-3 font-semibold text-[var(--color-text-secondary)] text-xs uppercase tracking-wide">Avg</th>
              <th className="text-center px-3 py-3 font-semibold text-[var(--color-text-secondary)] text-xs uppercase tracking-wide">Submitted</th>
              {filtered.assignments.slice(0, 5).map(a => (
                <th key={a.id} className="text-center px-3 py-3 font-semibold text-[var(--color-text-secondary)] text-xs max-w-[120px]">
                  <span className="truncate block" title={a.title}>{a.title.slice(0, 18)}{a.title.length > 18 ? '…' : ''}</span>
                  <span className="font-normal opacity-60">{a.maxPoints}pts</span>
                </th>
              ))}
              {filtered.assignments.length > 5 && (
                <th className="text-center px-3 py-3 text-xs text-[var(--color-text-secondary)]">+{filtered.assignments.length - 5} more</th>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((st, i) => {
              const name = st.profile?.name?.fullName || st.userId;
              const avPct = st.avg;
              const avColor = avPct == null ? '' : avPct >= 80 ? 'text-green-600' : avPct >= 60 ? 'text-blue-600' : avPct >= 40 ? 'text-amber-600' : 'text-red-600';

              return (
                <tr key={st.userId} className={`border-b border-[var(--color-border)] hover:bg-[var(--color-bg)] transition ${i % 2 === 0 ? '' : 'bg-[var(--color-bg)]/30'}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center justify-center text-xs font-semibold shrink-0">
                        {name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--color-text)] truncate text-xs">{name}</p>
                        <p className="text-xs text-[var(--color-text-secondary)] truncate">{st.profile?.emailAddress || ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`font-bold text-sm ${avColor}`}>
                      {avPct != null ? `${avPct}%` : '—'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {st.submitted}/{filtered.assignments.length}
                    </span>
                  </td>
                  {filtered.assignments.slice(0, 5).map(a => {
                    const g = grades[st.userId]?.[a.id];
                    return (
                      <td key={a.id} className="px-3 py-3 text-center">
                        {g ? <ScoreBar score={g.score} max={a.maxPoints} /> : <StateBadge state={g?.state} />}
                      </td>
                    );
                  })}
                  {filtered.assignments.length > 5 && <td />}
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="text-center py-8 text-sm text-[var(--color-text-secondary)]">No students found</div>
        )}
      </div>
    </div>
  );
}

// ─── Course Report Panel ──────────────────────────────────────────────────────

function CourseReportPanel({ course }) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState('ALL');

  const { data: matrix, isLoading, error, refetch } = useGCGradeMatrix(course.id);

  // Summary stats from matrix
  const stats = useMemo(() => {
    if (!matrix) return null;
    const { students, assignments, grades } = matrix;
    let totalSubmitted = 0, totalPossible = 0, graded = 0, scores = [];

    for (const st of students) {
      for (const a of assignments) {
        const g = grades[st.userId]?.[a.id];
        if (!g) continue;
        totalPossible++;
        if (g.state === 'TURNED_IN' || g.state === 'RETURNED') totalSubmitted++;
        if (g.score != null) {
          graded++;
          if (a.maxPoints) scores.push((g.score / a.maxPoints) * 100);
        }
      }
    }

    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const submissionRate = totalPossible ? Math.round((totalSubmitted / totalPossible) * 100) : 0;

    return { students: students.length, assignments: assignments.length, submissionRate, avgScore, graded };
  }, [matrix]);

  return (
    <div className="card">
      <div className="flex items-center justify-between cursor-pointer -mx-6 -mt-6 px-6 pt-6 pb-4 border-b border-[var(--color-border)] mb-4"
        onClick={() => setExpanded(e => !e)}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
            {course.name?.charAt(0)}
          </div>
          <div>
            <h2 className="font-semibold text-[var(--color-text)]">{course.name}</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">{course.section || 'No section'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {stats && (
            <div className="hidden sm:flex items-center gap-4 text-xs text-[var(--color-text-secondary)]">
              <span>{stats.students} students</span>
              <span>{stats.assignments} assignments</span>
              {stats.avgScore != null && (
                <span className={`font-semibold ${stats.avgScore >= 70 ? 'text-green-600' : stats.avgScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                  Class avg: {stats.avgScore}%
                </span>
              )}
            </div>
          )}
          <button onClick={e => { e.stopPropagation(); refetch(); }}
            className="p-2 rounded-lg hover:bg-[var(--color-bg)] text-[var(--color-text-secondary)] transition">
            <RefreshCw size={14} />
          </button>
          <ChevronDown size={16} className={`text-[var(--color-text-secondary)] transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {expanded && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-[var(--color-text-secondary)]" />
              <span className="ml-3 text-sm text-[var(--color-text-secondary)]">Loading grade data…</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertCircle size={24} className="mx-auto mb-2 text-red-500" />
              <p className="text-sm text-[var(--color-text-secondary)]">{error.message}</p>
            </div>
          ) : matrix ? (
            <>
              {/* Stats row */}
              {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="Students" value={stats.students} color="blue" icon={Users} />
                  <StatCard label="Submission Rate" value={`${stats.submissionRate}%`} color="green" icon={CheckCircle2} />
                  <StatCard label="Class Average" value={stats.avgScore != null ? `${stats.avgScore}%` : '—'}
                    color={stats.avgScore >= 70 ? 'green' : stats.avgScore >= 50 ? 'amber' : 'red'} icon={TrendingUp} />
                  <StatCard label="Graded" value={stats.graded} sub="submissions" color="purple" icon={Award} />
                </div>
              )}

              {/* Type filter */}
              <div className="flex items-center gap-2 flex-wrap">
                {['ALL', 'HOMEWORK', 'EXAM', 'TEST'].map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${filter === f
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-blue-500'}`}>
                    {f}
                  </button>
                ))}
              </div>

              <GradeTable matrix={matrix} filter={filter} />
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Reports() {
  const [connected, setConnected] = useState(isConnected());
  const canManage = useCanManage();
  const { data: courses = [], isLoading, error, refetch } = useGCCourses();

  if (!canManage) {
    return (
      <div className="space-y-6">
        <div>
          <div className="eyebrow">Module</div>
          <h1 className="text-3xl font-bold text-[var(--color-text)] -mt-1">Reports</h1>
        </div>
        <div className="card text-center py-16">
          <BarChart2 size={40} className="mx-auto mb-4 text-blue-500 opacity-40" />
          <p className="font-medium text-[var(--color-text)]">Reports are available to teachers only</p>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Contact your instructor for performance reports.</p>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="space-y-6">
        <div>
          <div className="eyebrow">Module</div>
          <h1 className="text-3xl font-bold text-[var(--color-text)] -mt-1">Reports</h1>
        </div>
        <div className="card text-center py-16 max-w-md mx-auto">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
            <BarChart2 size={36} className="text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">Connect Google Classroom</h2>
          <p className="text-[var(--color-text-secondary)] text-sm mb-8">
            Pull grade data, submission rates, and performance analytics directly from Classroom.
          </p>
          <button onClick={() => initiateGoogleAuth('/reports')}
            className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-[var(--color-text)] font-medium hover:border-blue-500 hover:shadow-md transition-all">
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
          <h1 className="text-3xl font-bold text-[var(--color-text)] -mt-1">Reports</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Google Classroom</span>
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

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={28} className="animate-spin text-[var(--color-text-secondary)]" />
        </div>
      ) : error ? (
        <div className="card text-center py-12">
          <AlertCircle size={32} className="mx-auto mb-3 text-red-500" />
          <p className="font-medium text-[var(--color-text)]">{error.message}</p>
          <button onClick={refetch} className="mt-4 px-4 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm hover:border-blue-500 transition">
            Try again
          </button>
        </div>
      ) : courses.length === 0 ? (
        <div className="card text-center py-16">
          <BarChart2 size={32} className="mx-auto mb-3 text-[var(--color-text-secondary)] opacity-40" />
          <p className="font-medium text-[var(--color-text)]">No active courses found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {courses.map(course => (
            <CourseReportPanel key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}