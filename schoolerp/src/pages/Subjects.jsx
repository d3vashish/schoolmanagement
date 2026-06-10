import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSubjects, useCreateSubject, useUpdateSubject, useDeleteSubject } from '../hooks/useSubjects';

const emptyForm = { name: '', code: '', department: '', description: '', credit_hours: '', lab_fee_amount: '' };

export default function Subjects() {
  const { user } = useAuth();
  const isAdmin = user?.usr === 'Administrator' || (user?.roles || []).includes('Administrator') || (user?.roles || []).includes('System Manager') || (user?.roles || []).includes('super_admin') || (user?.roles || []).includes('principal');
  const canEdit = isAdmin;

  const [search, setSearch]         = useState('');
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [form, setForm]             = useState(emptyForm);

  const { data: subjects = [], isLoading: loading } = useSubjects();

  const createMutation = useCreateSubject();
  const updateMutation = useUpdateSubject();
  const deleteMutation = useDeleteSubject();

  const saving = createMutation.isPending || updateMutation.isPending;

  const filtered = subjects.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.code?.toLowerCase().includes(search.toLowerCase()) ||
    s.department?.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  
  const openEdit = (sub) => {
    setEditing(sub);
    setForm({ 
      name: sub.name || '', 
      code: sub.code || '',
      department: sub.department || '', 
      description: sub.description || '',
      credit_hours: sub.credit_hours || '',
      lab_fee_amount: sub.lab_fee_amount || ''
    });
    setShowModal(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    const payload = { ...form };
    if (payload.credit_hours === '') payload.credit_hours = null;
    else payload.credit_hours = parseInt(payload.credit_hours, 10);
    
    if (payload.lab_fee_amount === '') payload.lab_fee_amount = null;
    else payload.lab_fee_amount = parseInt(payload.lab_fee_amount, 10);

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload }, {
        onSuccess: () => { setShowModal(false); setEditing(null); setForm(emptyForm); }
      });
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => { setShowModal(false); setForm(emptyForm); }
      });
    }
  };

  const handleDelete = () => {
    if (!deleteConfirm) return;
    deleteMutation.mutate(deleteConfirm.id, {
      onSuccess: () => setDeleteConfirm(null)
    });
  };

  const subjectColors = ['bg-blue-100 text-blue-700', 'bg-green-100 text-green-700',
    'bg-purple-100 text-purple-700', 'bg-amber-100 text-amber-700',
    'bg-pink-100 text-pink-700', 'bg-cyan-100 text-cyan-700'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow">Academics</div>
          <h1 className="text-3xl font-bold text-[var(--color-text)] -mt-1">Subjects</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">Manage school subjects and courses</p>
        </div>
        {canEdit && (
          <button onClick={openAdd} className="btn-primary flex items-center gap-2 group">
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center transition-all duration-300 group-hover:bg-white/30 group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </span>
            Add Subject
          </button>
        )}
      </div>

      {/* Subject Cards Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-[var(--color-text-secondary)]">Loading subjects…</span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" placeholder="Search subjects…" value={search}
                onChange={e => setSearch(e.target.value)} className="input pl-11" />
            </div>
            <p className="text-sm text-[var(--color-text-secondary)]">{filtered.length} subjects</p>
          </div>

          {filtered.length === 0 ? (
            <div className="card text-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <p className="text-[var(--color-text-secondary)]">No subjects yet. Add your first subject.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map((sub, i) => (
                <div key={sub.id}
                  className="card hover:shadow-md transition-all duration-200 group border-2 border-transparent hover:border-[var(--color-primary)]/20">
                  <div className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold mb-3 ${subjectColors[i % subjectColors.length]}`}>
                    {sub.code || sub.name.substring(0, 4).toUpperCase()}
                  </div>
                  <h3 className="font-semibold text-[var(--color-text)] mb-1 leading-tight">{sub.name}</h3>
                  {sub.department && (
                    <p className="text-xs text-[var(--color-text-secondary)] mb-2">{sub.department}</p>
                  )}
                  {sub.description && (
                    <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 mb-3">{sub.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {sub.credit_hours != null && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-800">
                        {sub.credit_hours} Credits
                      </span>
                    )}
                    {sub.lab_fee_amount != null && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">
                        Fee: ${sub.lab_fee_amount}
                      </span>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(sub)}
                        className="flex-1 py-1.5 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded-lg transition-colors">
                        Edit
                      </button>
                      <button onClick={() => setDeleteConfirm(sub)}
                        className="flex-1 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--color-text)]">{editing ? 'Edit Subject' : 'Add Subject'}</h2>
              <button onClick={() => setShowModal(false)} className="group w-6 h-6 rounded-full bg-black/5 flex items-center justify-center group-hover:bg-black/10 transition-all duration-300">
                <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
                  Subject Name <span className="text-red-500">*</span>
                </label>
                <input name="name" value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="input" placeholder="e.g. Mathematics" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Subject Code</label>
                <input name="code" value={form.code}
                  onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                  className="input" placeholder="e.g. MATH101" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Department</label>
                <input name="department" value={form.department}
                  onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
                  className="input" placeholder="e.g. Science & Maths" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Description</label>
                <textarea name="description" value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className="input resize-none" rows={3} placeholder="Brief description…" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Credit Hours</label>
                  <input type="number" name="credit_hours" value={form.credit_hours}
                    onChange={e => setForm(p => ({ ...p, credit_hours: e.target.value }))}
                    className="input" placeholder="e.g. 3" min="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Lab Fee ($)</label>
                  <input type="number" name="lab_fee_amount" value={form.lab_fee_amount}
                    onChange={e => setForm(p => ({ ...p, lab_fee_amount: e.target.value }))}
                    className="input" placeholder="e.g. 50" min="0" />
                </div>
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
            <h3 className="text-lg font-bold text-[var(--color-text)] mb-2">Delete Subject</h3>
            <p className="text-[var(--color-text-secondary)] mb-6">Delete <strong>{deleteConfirm.name}</strong>?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">Cancel</button>
              <button onClick={handleDelete} disabled={deleteMutation.isPending} className="px-4 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
