import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAcademicYear } from '../context/AcademicYearContext';
import { getList, createDoc, updateDoc, getDoc } from '../api/frappe';
import { useFrappeList } from '../hooks/useFrappeQuery';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function Programs() {
  const { user } = useAuth();
  const { selectedYear } = useAcademicYear();
  const queryClient = useQueryClient();
  const isAdmin = user?.roles?.some(r => r === 'Administrator' || r === 'System Manager' || r === 'Academics User');

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ program_name: '', program_code: '', description: '' });

  const { data: programs = [], isLoading: loading } = useFrappeList('Program', [], ['name', 'program_name', 'program_code', 'description', 'disabled'], 200);

  // Fetch all student groups for the selected year to compute student counts
  const { data: yearGroups = [] } = useQuery({
    queryKey: ['Programs', 'yearGroups', selectedYear],
    queryFn: () => getList('Student Group', [['academic_year', '=', selectedYear]], ['name', 'program', 'students'], 500),
    enabled: !!selectedYear,
    staleTime: 60 * 1000,
  });

  // Compute student counts from yearGroups (count active students per program)
  const studentCounts = {};
  yearGroups.forEach(g => {
    const prog = g.program;
    if (!prog) return;
    const activeStudents = (g.students || []).filter(s => s.active).length;
    studentCounts[prog] = (studentCounts[prog] || 0) + activeStudents;
  });

  const createMutation = useMutation({
    mutationFn: (data) => createDoc('Program', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['Program'] }); setShowModal(false); },
    onError: (err) => alert('Failed to create: ' + (err.response?.data?.message || err.message)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ name, data }) => updateDoc('Program', name, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['Program'] }); setShowModal(false); },
    onError: (err) => alert('Failed to update: ' + (err.response?.data?.message || err.message)),
  });

  const deactivateMutation = useMutation({
    mutationFn: (name) => updateDoc('Program', name, { disabled: 1 }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['Program'] }); setDeleteConfirm(null); },
    onError: () => alert('Failed to deactivate'),
  });

  const filteredPrograms = programs.filter(p =>
    p.program_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.program_code?.toLowerCase().includes(search.toLowerCase())
  );

  const openAddModal = () => {
    setEditingProgram(null);
    setFormData({ program_name: '', program_code: '', description: '' });
    setShowModal(true);
  };

  const openEditModal = async (program) => {
    try {
      const p = await getDoc('Program', program.name);
      setEditingProgram(p);
      setFormData({
        program_name: p.program_name || '',
        program_code: p.program_code || '',
        description: p.description || '',
      });
      setShowModal(true);
    } catch (err) { console.error('Failed to fetch program:', err); }
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!formData.program_name) { alert('Program name is required'); return; }
    setSaving(true);
    if (editingProgram) {
      updateMutation.mutate({ name: editingProgram.name, data: formData }, { onSettled: () => setSaving(false) });
    } else {
      createMutation.mutate(formData, { onSettled: () => setSaving(false) });
    }
  };

  const handleDelete = () => {
    if (!deleteConfirm) return;
    deactivateMutation.mutate(deleteConfirm.name);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow">Academics</div>
          <h1 className="text-2xl font-semibold text-[#1F1F1F] -mt-1">Programs</h1>
          <p className="text-[#475569] mt-1">Grade levels and academic programs</p>
        </div>
        {isAdmin && (
          <button onClick={openAddModal} className="btn-primary flex items-center gap-2 group">
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center transition-all duration-300 group-hover:bg-white/30 group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </span>
            Add Program
          </button>
        )}
      </div>

      <div className="card">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search programs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-12"
            />
          </div>
          <p className="text-sm text-[#475569]">{filteredPrograms.length} programs</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header">Code</th>
                <th className="table-header">Program Name</th>
                <th className="table-header">Description</th>
                <th className="table-header">Students</th>
                <th className="table-header">Status</th>
                {isAdmin && <th className="table-header">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="table-cell text-center py-12">
                    <span className="w-8 h-8 border-2 border-[#2ED05D] border-t-transparent rounded-full animate-spin inline-block"></span>
                  </td>
                </tr>
              ) : filteredPrograms.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="table-cell text-center py-12 text-[#475569]">
                    {search ? 'No programs found' : 'No programs found. Create your first program.'}
                  </td>
                </tr>
              ) : (
                filteredPrograms.map((program) => (
                  <tr key={program.name} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell font-medium text-[#2ED05D]">{program.program_code || '-'}</td>
                    <td className="table-cell font-semibold">{program.program_name}</td>
                    <td className="table-cell text-[#475569]">{program.description || '-'}</td>
                    <td className="table-cell">{studentCounts[program.name] || 0}</td>
                    <td className="table-cell">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        program.disabled ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {program.disabled ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEditModal(program)} className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer group" title="Edit">
                            <span className="w-5 h-5 flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:translate-x-0.5 group-hover:-translate-y-[1px]">
                              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </span>
                          </button>
                          <button onClick={() => setDeleteConfirm(program)} className="p-2 hover:bg-red-50 rounded-lg cursor-pointer group" title="Deactivate">
                            <span className="w-5 h-5 flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:translate-x-0.5 group-hover:-translate-y-[1px]">
                              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </span>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && isAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[#1F1F1F]">{editingProgram ? 'Edit Program' : 'Add Program'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer group">
                <span className="w-6 h-6 rounded-full bg-black/5 flex items-center justify-center group-hover:bg-black/10 transition-all duration-300">
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </span>
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1F1F1F] mb-2">Program Name <span className="text-red-500">*</span></label>
                <input type="text" name="program_name" value={formData.program_name} onChange={e => setFormData(prev => ({ ...prev, program_name: e.target.value }))} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1F1F1F] mb-2">Program Code</label>
                <input type="text" name="program_code" value={formData.program_code} onChange={e => setFormData(prev => ({ ...prev, program_code: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1F1F1F] mb-2">Description</label>
                <textarea name="description" value={formData.description} onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} className="input min-h-[100px]" />
              </div>
              <div className="flex items-center justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-50 group">
                  {saving && <span className="w-4 h-4 flex items-center justify-center"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /></span>}
                  {editingProgram ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && isAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#1F1F1F]">Deactivate Program</h3>
                <p className="text-sm text-[#475569]">This will mark the program as inactive</p>
              </div>
            </div>
            <p className="text-[#1F1F1F] mb-6">Are you sure you want to deactivate <strong>{deleteConfirm.program_name}</strong>?</p>
            <div className="flex items-center justify-end gap-4">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">Cancel</button>
              <button onClick={handleDelete} className="px-6 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 cursor-pointer">Deactivate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
