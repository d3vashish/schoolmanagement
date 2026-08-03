import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { client } from '../api/frappe';

export default function Promotion() {
  const [fromYear, setFromYear] = useState('');
  const [toYear, setToYear] = useState('');
  const [fromClass, setFromClass] = useState('');
  const [toClass, setToClass] = useState('');
  const [toSection, setToSection] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);   // { promoted, retained }
  const [error, setError] = useState('');

  // ── Reference data ──
  const { data: years = [] } = useQuery({
    queryKey: ['promotion', 'years'],
    queryFn: async () => (await client.get('/academic/years')).data || [],
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['promotion', 'classes'],
    queryFn: async () => (await client.get('/academic/classes')).data || [],
  });

  const { data: sections = [] } = useQuery({
    queryKey: ['promotion', 'sections'],
    queryFn: async () => (await client.get('/academic/sections')).data || [],
  });

  const { data: studentsResp, isLoading: loadingStudents } = useQuery({
    queryKey: ['promotion', 'students'],
    queryFn: async () => (await client.get('/academic/students?per_page=500')).data,
  });
  const allStudents = studentsResp?.data || [];

  // ── Sensible defaults once data loads ──
  useEffect(() => {
    if (!years.length) return;
    const current = years.find(y => y.is_current) || years.find(y => y.is_active) || years[0];
    setFromYear(prev => prev || current.id);
    // default "to" year = the next one after current by start_date, else same
    const sorted = [...years].sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
    const idx = sorted.findIndex(y => y.id === current.id);
    const next = sorted[idx + 1] || current;
    setToYear(prev => prev || next.id);
  }, [years]);

  useEffect(() => {
    if (!classes.length) return;
    const ordered = [...classes].sort((a, b) => a.order - b.order);
    setFromClass(prev => prev || ordered[0].id);
  }, [classes]);

  // sections belonging to the selected "to" class
  const toSections = useMemo(
    () => sections.filter(s => s.class_id === toClass),
    [sections, toClass]
  );
  useEffect(() => {
    setToSection(toSections[0]?.id || '');
  }, [toClass, sections]); // eslint-disable-line react-hooks/exhaustive-deps

  // default "to" class = next class by order after the selected "from" class
  useEffect(() => {
    if (!classes.length || !fromClass) return;
    const ordered = [...classes].sort((a, b) => a.order - b.order);
    const idx = ordered.findIndex(c => c.id === fromClass);
    const next = ordered[idx + 1] || ordered[idx];
    setToClass(next.id);
  }, [fromClass, classes]);

  // ── Students in the selected "from" class (active enrollment) ──
  // The student-list API returns the class NAME (student_group_name), not class_id,
  // so match on the selected class's name.
  const fromClassName = useMemo(
    () => classes.find(c => c.id === fromClass)?.name || null,
    [classes, fromClass]
  );
  const roster = useMemo(
    () => allStudents.filter(s => s.is_active && fromClassName && s.student_group_name === fromClassName),
    [allStudents, fromClassName]
  );

  // reset selection when the roster changes
  useEffect(() => {
    setSelected(new Set(roster.map(s => s.id)));
    setResult(null);
    setError('');
  }, [fromClass, allStudents]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const allChecked = roster.length > 0 && selected.size === roster.length;
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(roster.map(s => s.id)));

  const isRetention = fromClass && toClass && fromClass === toClass;
  const className = (id) => classes.find(c => c.id === id)?.name || '—';
  const yearName = (id) => years.find(y => y.id === id)?.name || '—';

  const promote = async () => {
    setError('');
    setResult(null);
    if (selected.size === 0) { setError('Select at least one student.'); return; }
    if (!fromYear || !toYear || !toClass) { setError('Choose the years and target class.'); return; }
    setSubmitting(true);
    try {
      const res = await client.post('/academic/progression/promote', {
        student_ids: [...selected],
        from_academic_year_id: fromYear,
        to_academic_year_id: toYear,
        to_class_id: toClass,
        to_section_id: toSection || null,
      });
      const rows = res.data || [];
      const retained = rows.filter(r => r.is_retained).length;
      setResult({ promoted: rows.length, retained });
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Promotion failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div>
        <div className="eyebrow">Academics</div>
        <h1 className="text-3xl font-bold text-[var(--color-text)] -mt-1">Promote Students</h1>
        <p className="text-[var(--color-text-secondary)] mt-1">
          Move a class up to the next academic year, or hold students back.
        </p>
      </div>

      {years.length < 2 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">
          You only have one academic year. To promote students <b>into a new year</b>, create the next
          academic year first (e.g. 2027-28). You can still promote within the same year (a class transfer).
        </div>
      )}

      {/* Selectors */}
      <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">From Year</label>
          <select value={fromYear} onChange={e => setFromYear(e.target.value)} className="input w-full">
            {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">To Year</label>
          <select value={toYear} onChange={e => setToYear(e.target.value)} className="input w-full">
            {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">From Class</label>
          <select value={fromClass} onChange={e => setFromClass(e.target.value)} className="input w-full">
            {[...classes].sort((a,b)=>a.order-b.order).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">To Class</label>
          <select value={toClass} onChange={e => setToClass(e.target.value)} className="input w-full">
            {[...classes].sort((a,b)=>a.order-b.order).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">To Section</label>
          <select value={toSection} onChange={e => setToSection(e.target.value)} className="input w-full">
            {toSections.length === 0 && <option value="">No sections — create one first</option>}
            {toSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {isRetention && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-4 py-3 text-sm">
          From and To class are the same — these students will be <b>retained</b> (held back) in {className(fromClass)}.
        </div>
      )}

      {/* Roster */}
      <div className="bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]">
          <span className="font-semibold text-[var(--color-text)]">
            {className(fromClass)} — {roster.length} student{roster.length === 1 ? '' : 's'}
          </span>
          <label className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] cursor-pointer">
            <input type="checkbox" checked={allChecked} onChange={toggleAll} />
            Select all
          </label>
        </div>

        {loadingStudents ? (
          <div className="py-10 text-center text-[var(--color-text-secondary)]">Loading students…</div>
        ) : roster.length === 0 ? (
          <div className="py-10 text-center text-[var(--color-text-secondary)]">
            No active students enrolled in this class.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {roster.map(s => {
              const name = `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.email;
              return (
                <li key={s.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
                  <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[var(--color-text)] truncate">{name}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] truncate">
                      {s.admission_number || '—'}{s.section_name ? ` · Section ${s.section_name}` : ''}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">⚠️ {error}</div>
      )}
      {result && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-sm">
          ✓ {result.promoted} student{result.promoted === 1 ? '' : 's'} moved to {className(toClass)} ({yearName(toYear)})
          {result.retained > 0 && ` — ${result.retained} retained`}.
        </div>
      )}

      {/* Action */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-text-secondary)]">
          {selected.size} selected → <b>{className(toClass)}</b>, <b>{yearName(toYear)}</b>
        </p>
        <button
          onClick={promote}
          disabled={submitting || selected.size === 0}
          className={`btn-primary px-6 py-2.5 font-semibold ${(submitting || selected.size === 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {submitting ? 'Promoting…' : isRetention ? `Retain ${selected.size}` : `Promote ${selected.size}`}
        </button>
      </div>
    </div>
  );
}