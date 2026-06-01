import { useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { useAcademicYear } from '../context/AcademicYearContext';
import { getList, getDoc } from '../api/frappe';
import { useFrappeList, useFrappeCreate, useFrappeUpdate, useFrappeDelete } from '../hooks/useFrappeQuery';
import { useQuery } from '@tanstack/react-query';

// 1:1 validation: check if a teacher is already assigned to another class
const validateOneToOne = async (teacherEmail, currentGroupName) => {
  if (!teacherEmail) return null;
  const existing = await getList(
    'Student Group',
    [['class_teacher', '=', teacherEmail]],
    ['name', 'student_group_name'],
    1
  );
  if (existing.length > 0 && existing[0].name !== currentGroupName) {
    return existing[0].student_group_name || existing[0].name;
  }
  return null;
};

export default function Classes() {
  const settings = useSettings();
  const { user } = useAuth();
  const { selectedYear, isCurrentYear, yearGroups, yearPrograms } = useAcademicYear();
  const isTeacher = user?.roles?.includes('Instructor');
  const emptyForm = {
    student_group_name: '',
    program: '',
    academic_year: selectedYear || settings?.academic_year || '',
    academic_term: '',
    max_strength: '',
    group_based_on: 'Batch',
    class_teacher: '',
  };

  const [search, setSearch]         = useState('');
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [form, setForm]             = useState(emptyForm);

  // Use shared year-scoped data from context
  const classes = yearGroups;
  const programs = yearPrograms;
  const loading = false; // yearGroups is already loaded by context
  const { data: users = [] } = useFrappeList('User', [['enabled', '=', 1]], ['name', 'full_name', 'email'], 200);

  const createMutation = useFrappeCreate('Student Group', {
    onSuccess: () => { setShowModal(false); setEditing(null); },
  });
  const updateMutation = useFrappeUpdate('Student Group', {
    onSuccess: () => { setShowModal(false); setEditing(null); },
  });
  const deleteMutation = useFrappeDelete('Student Group', {
    onSuccess: () => setDeleteConfirm(null),
  });

  const saving = createMutation.isPending || updateMutation.isPending;

  const filtered = classes.filter(c => {
    if (isTeacher && c.class_teacher !== user.name) return false;
    return c.student_group_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.program?.toLowerCase().includes(search.toLowerCase());
  });

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = async (cls) => {
    try {
      const doc = await getDoc('Student Group', cls.name);
      setEditing(doc);
      setForm({
        student_group_name: doc.student_group_name || '',
        program: doc.program || '',
        academic_year: doc.academic_year || settings?.academic_year || '',
        academic_term: doc.academic_term || '',
        max_strength: doc.max_strength || '',
        group_based_on: doc.group_based_on || 'Batch',
        class_teacher: doc.class_teacher || '',
      });
      setShowModal(true);
    } catch (err) { console.error(err); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.student_group_name) return;

    // 1:1 validation
    if (form.class_teacher) {
      const existingClass = await validateOneToOne(form.class_teacher, editing?.name);
      if (existingClass) {
        alert(`This teacher is already assigned as class teacher of "${existingClass}". One teacher can only be assigned to one class.`);
        return;
      }
    }

    const payload = {
      student_group_name: form.student_group_name,
      program: form.program,
      academic_year: form.academic_year,
      academic_term: form.academic_term,
      max_strength: form.max_strength ? parseInt(form.max_strength) : undefined,
      group_based_on: form.group_based_on,
      class_teacher: form.class_teacher || '',
    };
    if (editing) {
      updateMutation.mutate({ name: editing.name, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = () => {
    if (!deleteConfirm) return;
    deleteMutation.mutate(deleteConfirm.name);
  };

  const handleChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow">Academics</div>
          <h1 className="text-3xl font-bold text-[var(--color-text)] -mt-1">Classes</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">
            Manage class groups and sections
            {selectedYear && (
              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#BBF7D0] text-[#2ED05D]">
                {selectedYear}
              </span>
            )}
          </p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 group">
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center transition-all duration-300 group-hover:bg-white/30 group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </span>
          Add Class
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Classes', value: classes.length, color: 'blue' },
          { label: 'Programs', value: programs.length, color: 'purple' },
          { label: 'Academic Year', value: settings?.academic_year || '-', color: 'amber' },
          { label: 'Active', value: classes.length, color: 'green' },
        ].map(stat => (
          <div key={stat.label} className="card text-center py-4">
            <p className="text-2xl font-bold text-[var(--color-text)]">{stat.value}</p>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1 max-w-sm">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Search classes…" value={search}
              onChange={e => setSearch(e.target.value)} className="input pl-11" />
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">{filtered.length} records</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Class Name', 'Program / Standard', 'Class Teacher', 'Academic Year', 'Group Based On', 'Max Students', 'Actions'].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="table-cell text-center py-12">
                  <span className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin inline-block" />
                  <span className="ml-2 text-[var(--color-text-secondary)]">Loading…</span>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="table-cell text-center py-12 text-[var(--color-text-secondary)]">
                  No classes found. Click "Add Class" to create one.
                </td></tr>
              ) : filtered.map(cls => {
                const teacher = users.find(u => u.name === cls.class_teacher);
                return (
                <tr key={cls.name} className="hover:bg-gray-50 transition-colors">
                  <td className="table-cell font-medium text-[var(--color-primary)]">{cls.student_group_name || cls.name}</td>
                  <td className="table-cell">{cls.program || '—'}</td>
                  <td className="table-cell">{teacher?.full_name || teacher?.name || '—'}</td>
                  <td className="table-cell">{cls.academic_year || '—'}</td>
                  <td className="table-cell">
                    <span className="px-2 py-1 bg-[#E8F9ED] text-[#2ED05D] rounded-lg text-xs font-medium">
                      {cls.group_based_on || 'Batch'}
                    </span>
                  </td>
                  <td className="table-cell">{cls.max_strength || '—'}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(cls)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors group" title="Edit">
                        <span className="w-5 h-5 flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:translate-x-0.5 group-hover:-translate-y-[1px]">
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </span>
                      </button>
                      <button onClick={() => setDeleteConfirm(cls)} className="p-2 hover:bg-red-50 rounded-lg transition-colors group" title="Delete">
                        <span className="w-5 h-5 flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:translate-x-0.5 group-hover:-translate-y-[1px]">
                          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--color-text)]">{editing ? 'Edit Class' : 'Add Class'}</h2>
              <button onClick={() => setShowModal(false)} className="group w-6 h-6 rounded-full bg-black/5 flex items-center justify-center group-hover:bg-black/10 transition-all duration-300">
                <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
                  Class Name <span className="text-red-500">*</span>
                </label>
                <input name="student_group_name" value={form.student_group_name} onChange={handleChange}
                  className="input" placeholder="e.g. 5th Standard - Section A" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Program / Standard</label>
                <select name="program" value={form.program} onChange={handleChange} className="input">
                  <option value="">— Select Program —</option>
                  {programs.map(p => <option key={p.name} value={p.name}>{p.program_name || p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Academic Year</label>
                  <input name="academic_year" value={form.academic_year} onChange={handleChange} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Max Students</label>
                  <input type="number" name="max_strength" value={form.max_strength} onChange={handleChange}
                    className="input" placeholder="40" min="1" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Group Based On</label>
                <select name="group_based_on" value={form.group_based_on} onChange={handleChange} className="input">
                  <option value="Batch">Batch</option>
                  <option value="Course">Course</option>
                  <option value="Activity">Activity</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Class Teacher</label>
                <select name="class_teacher" value={form.class_teacher} onChange={handleChange} className="input">
                  <option value="">— Select Teacher —</option>
                  {users.map(u => <option key={u.name} value={u.name}>{u.full_name || u.name}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-50 group">
                  {saving && <span className="w-4 h-4 flex items-center justify-center"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /></span>}
                  {editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-[var(--color-text)] mb-2">Delete Class</h3>
            <p className="text-[var(--color-text-secondary)] mb-6">
              Delete <strong>{deleteConfirm.student_group_name}</strong>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">Cancel</button>
              <button onClick={handleDelete} disabled={deleteMutation.isPending} className="px-4 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
