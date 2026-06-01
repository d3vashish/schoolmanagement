import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getList, getDoc, updateDoc } from '../api/frappe';
import { useAcademicYear } from '../context/AcademicYearContext';

export default function AssignStudentGroupModal({ isOpen, onClose, instructorName, instructorFullName, onSuccess }) {
  const queryClient = useQueryClient();
  const { selectedYear } = useAcademicYear();
  const [selectedGroup, setSelectedGroup] = useState('');

  const { data: studentGroups = [], isLoading: loading } = useQuery({
    queryKey: ['AssignStudentGroupModal', 'groups', selectedYear],
    queryFn: () => {
      const filters = selectedYear ? [['academic_year', '=', selectedYear]] : [];
      return getList('Student Group', filters, ['name', 'student_group_name'], 500).catch(() => []);
    },
    enabled: isOpen,
  });

  const assignMutation = useMutation({
    mutationFn: async (groupName) => {
      const groupDoc = await getDoc('Student Group', groupName);
      const instructors = groupDoc.instructors || [];
      const alreadyAssigned = instructors.some(i => i.instructor === instructorName);
      if (alreadyAssigned) throw new Error('This instructor is already assigned to this student group!');
      instructors.push({
        doctype: 'Student Group Instructor',
        instructor: instructorName,
        instructor_name: instructorFullName,
      });
      await updateDoc('Student Group', groupName, { instructors });
      return { name: groupName };
    },
    onSuccess: (newGroup) => {
      queryClient.invalidateQueries({ queryKey: ['Student Group'] });
      onSuccess(newGroup);
      onClose();
      setSelectedGroup('');
    },
    onError: (err) => alert('Failed to assign to student group. ' + err.message),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedGroup) return;
    assignMutation.mutate(selectedGroup);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-900">Assign Teacher to Class</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors group">
            <span className="w-6 h-6 rounded-full bg-black/5 flex items-center justify-center transition-all duration-300 group-hover:bg-black/10">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </span>
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center py-6">
              <div className="w-8 h-8 border-2 border-[#2ED05D] border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-sm text-gray-500 font-medium">Loading classes...</p>
            </div>
          ) : (
            <form id="assign-group-form" onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Class *</label>
                <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)} className="input w-full bg-gray-50 text-sm" required>
                  <option value="">Select Class...</option>
                  {studentGroups.map(g => <option key={g.name} value={g.name}>{g.student_group_name || g.name}</option>)}
                </select>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                  Assigning an instructor will grant them manager access over this class.
                </p>
              </div>
            </form>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-600 hover:text-gray-900">Cancel</button>
          <button type="submit" form="assign-group-form" disabled={loading || assignMutation.isPending || !selectedGroup}
            className="btn-primary text-sm px-6 py-2 shadow-sm flex items-center gap-2 group">
            {assignMutation.isPending ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
            ) : 'Assign Teacher'}
          </button>
        </div>
      </div>
    </div>
  );
}
