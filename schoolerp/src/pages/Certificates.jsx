import { useState } from 'react';
import {
  Award, Download, FileText, RefreshCw, LogOut,
  AlertCircle, Loader2, Eye, Search, X,
  CheckCircle2, ExternalLink, ChevronDown, Users, Sparkles
} from 'lucide-react';
import {
  isConnected, initiateGoogleAuth, clearToken
} from '../api/googleClassroom';
import {
  useGCCourses, useGCStudents, useGCDriveTemplates, useGCGenerateCertificate
} from '../hooks/useGoogleClassroom';
import { useAuth } from '../context/AuthContext';

function useCanManage() {
  const { user } = useAuth();
  const roles = user?.roles || [];
  return roles.includes('Administrator') || roles.includes('Instructor') || roles.includes('Academics User');
}

// ─── Certificate Type Presets ─────────────────────────────────────────────────

const CERT_TYPES = [
  { id: 'completion', label: 'Course Completion', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400', border: 'border-emerald-300 dark:border-emerald-700' },
  { id: 'merit', label: 'Merit', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400', border: 'border-amber-300 dark:border-amber-700' },
  { id: 'participation', label: 'Participation', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400', border: 'border-blue-300 dark:border-blue-700' },
  { id: 'excellence', label: 'Excellence', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400', border: 'border-purple-300 dark:border-purple-700' },
];

// ─── Single Certificate Generator ────────────────────────────────────────────

function CertificateRow({ student, course, templateId, certType, date }) {
  const generate = useGCGenerateCertificate();
  const [pdfUrl, setPdfUrl] = useState(null);
  const [grade, setGrade] = useState('');

  async function handleGenerate() {
    if (!templateId) {
      alert('Please select a certificate template first.');
      return;
    }
    try {
      const url = await generate.mutateAsync({
        studentName: student.profile?.name?.fullName || student.userId,
        course: course.name,
        date,
        grade: grade || certType,
        templateId,
      });
      setPdfUrl(url);
    } catch (err) {
      alert(`Failed: ${err.message}`);
    }
  }

  const name = student.profile?.name?.fullName || student.userId;
  const email = student.profile?.emailAddress || '';

  return (
    <div className="flex items-center gap-4 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] hover:border-emerald-400 transition group">
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0 text-emerald-700 font-semibold text-sm">
        {name.charAt(0).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-[var(--color-text)] truncate">{name}</p>
        <p className="text-xs text-[var(--color-text-secondary)] truncate">{email}</p>
      </div>

      {/* Grade/note input */}
      <input
        type="text"
        value={grade}
        onChange={e => setGrade(e.target.value)}
        placeholder="Grade / note"
        className="w-28 px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
      />

      {pdfUrl ? (
        <a href={pdfUrl} download={`Certificate-${name}.pdf`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition">
          <Download size={12} />
          Download
        </a>
      ) : (
        <button onClick={handleGenerate} disabled={generate.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-400 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-xs font-medium transition disabled:opacity-50">
          {generate.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          Generate
        </button>
      )}
    </div>
  );
}

// ─── Course Certificate Panel ─────────────────────────────────────────────────

function CourseCertPanel({ course, templateId, certType, date, canManage }) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');
  const { data: students = [], isLoading } = useGCStudents(course.id);

  const filtered = students.filter(s => {
    const name = s.profile?.name?.fullName || s.userId || '';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="card">
      <div className="flex items-center justify-between cursor-pointer -mx-6 -mt-6 px-6 pt-6 pb-4 border-b border-[var(--color-border)] mb-4"
        onClick={() => setExpanded(e => !e)}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
            {course.name?.charAt(0)}
          </div>
          <div>
            <h2 className="font-semibold text-[var(--color-text)]">{course.name}</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {course.section || 'No section'} · {students.length} students
            </p>
          </div>
        </div>
        <ChevronDown size={16} className={`text-[var(--color-text-secondary)] transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </div>

      {expanded && (
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search students..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-[var(--color-text-secondary)]" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)] text-center py-6">No students found</p>
          ) : (
            <div className="space-y-2">
              {filtered.map(student => (
                <CertificateRow
                  key={student.userId}
                  student={student}
                  course={course}
                  templateId={templateId}
                  certType={certType}
                  date={date}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Template Picker ──────────────────────────────────────────────────────────

function TemplatePicker({ value, onChange }) {
  const { data: templates = [], isLoading } = useGCDriveTemplates();

  return (
    <div>
      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
        Google Doc Template
      </label>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <Loader2 size={14} className="animate-spin" /> Loading Drive files…
        </div>
      ) : (
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition text-sm"
        >
          <option value="">— Select a Google Doc template —</option>
          {templates.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      )}
      <p className="text-xs text-[var(--color-text-secondary)] mt-1.5">
        Your Doc should have placeholders: <code className="bg-[var(--color-bg)] px-1 rounded">{'{{STUDENT_NAME}}'}</code>, <code className="bg-[var(--color-bg)] px-1 rounded">{'{{COURSE}}'}</code>, <code className="bg-[var(--color-bg)] px-1 rounded">{'{{DATE}}'}</code>, <code className="bg-[var(--color-bg)] px-1 rounded">{'{{GRADE}}'}</code>
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Certificates() {
  const [connected, setConnected] = useState(isConnected());
  const [templateId, setTemplateId] = useState(import.meta.env.VITE_CERTIFICATE_TEMPLATE_ID || '');
  const [certType, setCertType] = useState('completion');
  const [date, setDate] = useState(new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }));

  const canManage = useCanManage();
  const { data: courses = [], isLoading, error, refetch } = useGCCourses();

  if (!connected) {
    return (
      <div className="space-y-6">
        <div>
          <div className="eyebrow">Module</div>
          <h1 className="text-3xl font-bold text-[var(--color-text)] -mt-1">Certificates</h1>
        </div>
        <div className="card text-center py-16 max-w-md mx-auto">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
            <Award size={36} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">Connect Google Workspace</h2>
          <p className="text-[var(--color-text-secondary)] text-sm mb-8 max-w-sm mx-auto">
            Connect to generate certificates from Google Docs templates and export as PDF.
          </p>
          <button onClick={() => initiateGoogleAuth('/certificates')}
            className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-[var(--color-text)] font-medium hover:border-emerald-500 hover:shadow-md transition-all">
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

  if (!canManage) {
    return (
      <div className="space-y-6">
        <div>
          <div className="eyebrow">Module</div>
          <h1 className="text-3xl font-bold text-[var(--color-text)] -mt-1">Certificates</h1>
        </div>
        <div className="card text-center py-16">
          <Award size={40} className="mx-auto mb-4 text-emerald-500 opacity-50" />
          <p className="font-medium text-[var(--color-text)]">Certificate generation is for teachers only</p>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Contact your instructor for certificates.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="eyebrow">Module</div>
          <h1 className="text-3xl font-bold text-[var(--color-text)] -mt-1">Certificates</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Google Workspace</span>
          </div>
          <button onClick={() => { clearToken(); setConnected(false); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] text-xs font-medium transition">
            <LogOut size={13} />
            Disconnect
          </button>
        </div>
      </div>

      {/* Config Panel */}
      <div className="card space-y-5">
        <h2 className="font-semibold text-[var(--color-text)] flex items-center gap-2">
          <FileText size={16} className="text-emerald-600" />
          Certificate Settings
        </h2>

        <TemplatePicker value={templateId} onChange={setTemplateId} />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Certificate Type</label>
            <div className="grid grid-cols-2 gap-2">
              {CERT_TYPES.map(ct => (
                <button key={ct.id} onClick={() => setCertType(ct.id)}
                  className={`px-3 py-2 rounded-xl border text-xs font-medium transition ${certType === ct.id ? `${ct.color} ${ct.border}` : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-secondary)]'}`}>
                  {ct.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Certificate Date</label>
            <input
              type="text"
              value={date}
              onChange={e => setDate(e.target.value)}
              placeholder="e.g. 21 May 2026"
              className="w-full px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition text-sm"
            />
          </div>
        </div>

        {!templateId && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm">
            <AlertCircle size={15} />
            Select a template above to start generating certificates. Or set <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">VITE_CERTIFICATE_TEMPLATE_ID</code> in your <code>.env</code>.
          </div>
        )}
      </div>

      {/* Per-course student list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={28} className="animate-spin text-[var(--color-text-secondary)]" />
        </div>
      ) : error ? (
        <div className="card text-center py-12">
          <AlertCircle size={32} className="mx-auto mb-3 text-red-500" />
          <p className="text-sm text-[var(--color-text-secondary)]">{error.message}</p>
          <button onClick={refetch} className="mt-4 px-4 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm hover:border-emerald-500 transition">
            Try again
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {courses.map(course => (
            <CourseCertPanel
              key={course.id}
              course={course}
              templateId={templateId}
              certType={CERT_TYPES.find(c => c.id === certType)?.label || certType}
              date={date}
              canManage={canManage}
            />
          ))}
        </div>
      )}
    </div>
  );
}