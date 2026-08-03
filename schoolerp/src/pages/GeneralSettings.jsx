import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { adminGetSettings, adminUpdateSettings, client } from '../api/frappe';

// Parses "2027-28" -> { name: "2027-28", start_date: "2027-04-01", end_date: "2028-03-31" }
// Falls back to a plain +1 year window if the trailing part isn't a valid 2-digit year suffix.
function parseAcademicYearName(raw) {
  const match = /^(\d{4})\s*-\s*(\d{2,4})$/.exec(raw.trim());
  if (!match) return null;
  const startYear = parseInt(match[1], 10);
  let endYear;
  if (match[2].length === 4) {
    endYear = parseInt(match[2], 10);
  } else {
    endYear = Math.floor(startYear / 100) * 100 + parseInt(match[2], 10);
    if (endYear <= startYear) endYear += 100;
  }
  return {
    name: raw.trim(),
    start_date: `${startYear}-04-01`,
    end_date: `${endYear}-03-31`,
  };
}

// Ensures the academic year typed into Settings exists as a real AcademicYear record
// and is marked active, creating it if necessary. Never throws — settings save should
// still succeed even if this sync fails.
async function syncAcademicYear(rawName) {
  const name = (rawName || '').trim();
  if (!name) return;

  const parsed = parseAcademicYearName(name);
  if (!parsed) return; // not in "YYYY-YY" / "YYYY-YYYY" shape, skip silently

  try {
    const { data: years = [] } = await client.get('/academic/years');
    const existing = years.find(y => y.name === name);

    if (existing) {
      if (!existing.is_active) {
        await client.patch(`/academic/years/${existing.id}/activate`);
      }
      return;
    }

    await client.post('/academic/years', { ...parsed, is_active: true });
  } catch {
    // Non-fatal: settings were still saved even if year sync failed.
  }
}

const SECTION = ({ title, children, index = 0, className = '' }) => (
  <div
    className={`p-[1.5px] rounded-[32px] bg-black/[0.02] border border-[var(--color-border-light)] animate-in h-full ${className}`}
    style={{ animationDelay: `${150 + index * 100}ms` }}
  >
    <div className="card h-full flex flex-col">
      <h3 className="text-base font-semibold text-[var(--color-text)] mb-4 pb-3 border-b border-[var(--color-border)] flex-shrink-0">
        {title}
      </h3>
      <div className="space-y-4 flex-1">{children}</div>
    </div>
  </div>
);

const Field = ({ label, hint, id, children, column }) => {
  if (column) {
    return (
      <div className="space-y-1">
        <label htmlFor={id} className="text-sm font-medium text-[var(--color-text)] cursor-pointer">{label}</label>
        {hint && <p className="text-xs text-[var(--color-text-secondary)]">{hint}</p>}
        {children}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1.5 items-start">
      <div>
        <label htmlFor={id} className="text-sm font-medium text-[var(--color-text)] cursor-pointer">{label}</label>
        {hint && <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{hint}</p>}
      </div>
      <div className="md:col-span-2">{children}</div>
    </div>
  );
};

const SelectField = ({ id, name, value, onChange, options }) => (
  <div className="relative">
    <select
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      className="input shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] appearance-none pr-10 cursor-pointer"
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
    <svg
      className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none"
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  </div>
);

const DEFAULT_FORM = {
  language: 'en',
  time_zone: 'Asia/Kolkata',
  date_format: 'dd-mm-yyyy',
  currency: 'INR',
  school_name: '',
  school_abbreviation: '',
  school_email: '',
  school_phone: '',
  school_address: '',
  academic_year: '',
  academic_term: '',
  max_students_per_section: '40',
};

export default function GeneralSettings() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminGetSettings()
      .then(settings => {
        if (settings && Array.isArray(settings)) {
          const map = {};
          settings.forEach(s => { map[s.key] = s.value; });
          setForm(prev => ({ ...prev, ...map }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setDirty(true);
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const settings = Object.entries(form).map(([key, value]) => ({ key, value }));
      await adminUpdateSettings(settings);
      await syncAcademicYear(form.academic_year);
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-6xl animate-fade">
        <div className="md:col-span-3 space-y-3">
          <div className="w-24 h-6 rounded-full shimmer" />
          <div className="w-64 h-9 rounded-lg shimmer" />
          <div className="w-48 h-4 rounded shimmer" />
        </div>
        <div className="md:col-span-2 p-[1.5px] rounded-[32px] bg-black/[0.02] border border-[var(--color-border-light)]">
          <div className="card space-y-4">
            <div className="w-44 h-5 rounded shimmer" />
            {[1, 2, 3, 4, 5].map(j => (
              <div key={j} className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1.5 items-start">
                <div className="w-24 h-4 rounded shimmer" />
                <div className="md:col-span-2 h-10 rounded-[var(--radius-sm)] shimmer" />
              </div>
            ))}
          </div>
        </div>
        <div className="md:col-span-1 p-[1.5px] rounded-[32px] bg-black/[0.02] border border-[var(--color-border-light)]">
          <div className="card space-y-4">
            <div className="w-36 h-5 rounded shimmer" />
            {[1, 2, 3].map(j => (
              <div key={j} className="space-y-1">
                <div className="w-20 h-3 rounded shimmer" />
                <div className="h-9 rounded-[var(--radius-sm)] shimmer" />
              </div>
            ))}
          </div>
        </div>
        <div className="md:col-span-3 p-[1.5px] rounded-[32px] bg-black/[0.02] border border-[var(--color-border-light)]">
          <div className="card space-y-4">
            <div className="w-44 h-5 rounded shimmer" />
            {[1, 2, 3, 4].map(j => (
              <div key={j} className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1.5 items-start">
                <div className="w-24 h-4 rounded shimmer" />
                <div className="md:col-span-2 h-10 rounded-[var(--radius-sm)] shimmer" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-6xl">
      {/* Header */}
      <div className="md:col-span-3 relative overflow-hidden rounded-[var(--radius-card)] p-5 bg-gradient-to-br from-white to-[var(--color-primary-light)]/30 border border-[var(--color-border)] animate-in-down">
        <div className="relative z-10">
          <div className="eyebrow">Configuration</div>
          <h1 className="text-3xl font-bold text-[var(--color-text)] -mt-1">General Settings</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">Configure your school ERP system</p>
        </div>
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-[var(--color-primary)]/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-[var(--color-primary)]/[0.03] blur-3xl pointer-events-none" />
      </div>

      {/* Success Toast */}
      {saved && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-2.5 bg-white border border-green-200 rounded-xl shadow-lg animate-in-down" role="status">
          <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-3 h-3 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <span className="text-sm font-medium text-green-700">Saved successfully</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSave} className="contents">
        <SECTION title="School Information" index={0} className="md:col-span-2">
          <Field label="School Name" hint="Displayed across all modules" id="school_name">
            <input id="school_name" name="school_name" value={form.school_name} onChange={handleChange}
              className="input shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]" placeholder="e.g. DPS Nagpur" />
          </Field>
          <Field label="Abbreviation" hint="Short name for reports" id="school_abbreviation">
            <input id="school_abbreviation" name="school_abbreviation" value={form.school_abbreviation} onChange={handleChange}
              className="input shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]" placeholder="e.g. DPS" />
          </Field>
          <Field label="Email" id="school_email">
            <input id="school_email" type="email" name="school_email" value={form.school_email} onChange={handleChange}
              className="input shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]" placeholder="school@example.com" />
          </Field>
          <Field label="Phone" id="school_phone">
            <input id="school_phone" type="tel" name="school_phone" value={form.school_phone} onChange={handleChange}
              className="input shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]" placeholder="+91 XXXXX XXXXX" />
          </Field>
          <Field label="Address" id="school_address">
            <textarea id="school_address" name="school_address" value={form.school_address} onChange={handleChange}
              className="input shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] resize-none" rows={2} placeholder="Full school address" />
          </Field>
        </SECTION>

        <SECTION title="Academic Configuration" index={1} className="md:col-span-1">
          <Field label="Academic Year" hint="Current academic year" id="academic_year" column>
            <input id="academic_year" name="academic_year" value={form.academic_year} onChange={handleChange}
              className="input shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]" placeholder="e.g. 2025-26" />
          </Field>
          <Field label="Academic Term" id="academic_term" column>
            <input id="academic_term" name="academic_term" value={form.academic_term} onChange={handleChange}
              className="input shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]" placeholder="e.g. Term 1" />
          </Field>
          <Field label="Max Students / Section" id="max_students_per_section" column>
            <input id="max_students_per_section" type="number" name="max_students_per_section" value={form.max_students_per_section}
              onChange={handleChange} className="input shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]" min="1" max="200" />
          </Field>
        </SECTION>

        <SECTION title="System Configuration" index={2} className="md:col-span-3">
          <Field label="Language" id="language">
            <SelectField id="language" name="language" value={form.language} onChange={handleChange}
              options={[
                { value: 'en', label: 'English' },
                { value: 'hi', label: 'Hindi' },
                { value: 'mr', label: 'Marathi' },
              ]} />
          </Field>
          <Field label="Timezone" id="time_zone">
            <SelectField id="time_zone" name="time_zone" value={form.time_zone} onChange={handleChange}
              options={[
                { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST, UTC+5:30)' },
                { value: 'Asia/Dubai', label: 'Asia/Dubai (GST, UTC+4)' },
                { value: 'UTC', label: 'UTC' },
              ]} />
          </Field>
          <Field label="Date Format" id="date_format">
            <SelectField id="date_format" name="date_format" value={form.date_format} onChange={handleChange}
              options={[
                { value: 'dd-mm-yyyy', label: 'DD-MM-YYYY' },
                { value: 'mm-dd-yyyy', label: 'MM-DD-YYYY' },
                { value: 'yyyy-mm-dd', label: 'YYYY-MM-DD' },
              ]} />
          </Field>
          <Field label="Currency" id="currency">
            <SelectField id="currency" name="currency" value={form.currency} onChange={handleChange}
              options={[
                { value: 'INR', label: 'INR — Indian Rupee' },
                { value: 'USD', label: 'USD — US Dollar' },
                { value: 'EUR', label: 'EUR — Euro' },
                { value: 'AED', label: 'AED — UAE Dirham' },
              ]} />
          </Field>
        </SECTION>

        {/* Bottom Bar */}
        <div className="md:col-span-3 p-3 bg-white/70 backdrop-blur-xl border border-[var(--color-border)] rounded-[var(--radius-sm)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-xs text-[var(--color-text-muted)]">All changes are saved to the system immediately</p>
            {dirty && (
              <span className="w-2 h-2 rounded-full bg-[var(--color-warning)] animate-pulse-soft" title="Unsaved changes" />
            )}
          </div>
          <button type="submit" disabled={saving}
            className="btn-primary flex items-center gap-3 disabled:opacity-50 group"
          >
            {saving && (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            <span>Save Settings</span>
            {!saving && (
              <span className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}