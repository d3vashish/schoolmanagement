import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { client } from '../api/frappe';
import DatePicker from './DatePicker';

const today = () => new Date().toISOString().split('T')[0];

// Stable empty array so effects don't loop when a request returns nothing / errors.
const EMPTY = [];

const STATUS = {
  PRESENT: { label: 'Present', btn: 'bg-emerald-500 text-white', pill: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: '✓' },
  ABSENT:  { label: 'Absent',  btn: 'bg-red-500 text-white',     pill: 'bg-red-100 text-red-700 border-red-200',           icon: '✗' },
  LEAVE:   { label: 'Leave',   btn: 'bg-amber-500 text-white',   pill: 'bg-amber-100 text-amber-700 border-amber-200',     icon: '◷' },
};

export default function TeacherAttendance() {
  const [date, setDate] = useState(today());
  const [marks, setMarks] = useState({});      // { [user_id]: 'PRESENT' | 'ABSENT' | 'LEAVE' }
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // 1) Load the list of teachers (reuses the existing /academic/instructors endpoint)
  const { data: teachers = [], isLoading: loadingTeachers } = useQuery({
    queryKey: ['teacher-attendance', 'instructors'],
    queryFn: async () => {
      const res = await client.get('/academic/instructors');
      return res.data || [];
    },
    retry: false,
  });

  // 2) Load any attendance already saved for the selected date
  const { data: existingData, refetch, error: recordsError } = useQuery({
    queryKey: ['teacher-attendance', 'records', date],
    queryFn: async () => {
      const res = await client.get('/staff/attendance', { params: { date } });
      return res.data || [];
    },
    retry: false,
  });
  const existing = existingData ?? EMPTY;
  const accessDenied = (recordsError?.response?.status || recordsError?.status) === 403;

  // Seed local marks from what's already saved when date/records change
  useEffect(() => {
    const seed = {};
    existing.forEach((r) => { seed[r.staff_id] = r.status; });
    setMarks(seed);
    setSaved(false);
  }, [existing, date]);

  const setStatus = (userId, status) => {
    setMarks((prev) => ({ ...prev, [userId]: status }));
    setSaved(false);
  };

  const allPresent = () => {
    const next = {};
    teachers.forEach((t) => { next[t.user_id] = 'PRESENT'; });
    setMarks(next);
    setSaved(false);
  };

  const counts = useMemo(() => {
    const c = { PRESENT: 0, ABSENT: 0, LEAVE: 0 };
    Object.values(marks).forEach((s) => { if (c[s] != null) c[s] += 1; });
    return c;
  }, [marks]);

  const markedCount = Object.keys(marks).length;

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const records = teachers
        .filter((t) => marks[t.user_id])
        .map((t) => ({ staff_id: t.user_id, date, status: marks[t.user_id] }));
      if (records.length === 0) { setError('Nothing to save — mark at least one teacher.'); setSaving(false); return; }
      await client.post('/staff/attendance/mark-bulk', records);
      setSaved(true);
      refetch();
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (accessDenied) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-6 text-sm text-center">
        You don't have permission to view staff attendance. This page is available to administrators and principals only.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">Date</label>
          <DatePicker value={date} onChange={setDate} />
        </div>
        <button onClick={allPresent}
          className="px-4 py-2 rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 text-sm font-semibold hover:bg-emerald-100">
          ✓ All Present
        </button>
        <button onClick={save} disabled={saving}
          className={`ml-auto btn-primary px-5 py-2.5 text-sm font-semibold ${saved ? '!bg-emerald-500' : ''}`}>
          {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Teacher Attendance'}
        </button>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-6 text-sm bg-white border border-[var(--color-border)] rounded-xl px-4 py-3">
        <span className="font-semibold">{markedCount}/{teachers.length} marked</span>
        <span className="text-emerald-600">● {counts.PRESENT} Present</span>
        <span className="text-red-600">● {counts.ABSENT} Absent</span>
        <span className="text-amber-600">● {counts.LEAVE} Leave</span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">⚠️ {error}</div>
      )}

      {/* Teacher list */}
      {loadingTeachers ? (
        <div className="py-10 text-center text-[var(--color-text-secondary)]">Loading teachers…</div>
      ) : teachers.length === 0 ? (
        <div className="py-10 text-center text-[var(--color-text-secondary)]">No teachers found.</div>
      ) : (
        <div className="space-y-2">
          {teachers.map((t, i) => {
            const name = `${t.first_name || ''} ${t.last_name || ''}`.trim() || t.email;
            const current = marks[t.user_id];
            return (
              <div key={t.user_id}
                className="flex items-center justify-between bg-white border border-[var(--color-border)] rounded-xl px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-9 h-9 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center font-bold">
                    {(name[0] || '?').toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--color-text)] truncate">{name}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] truncate">{t.employee_id || t.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {Object.keys(STATUS).map((s) => (
                    <button key={s} onClick={() => setStatus(t.user_id, s)}
                      title={STATUS[s].label}
                      className={`w-10 h-10 rounded-full border text-sm font-bold transition
                        ${current === s ? STATUS[s].btn + ' border-transparent shadow' : 'bg-white text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-gray-50'}`}>
                      {STATUS[s].icon}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}