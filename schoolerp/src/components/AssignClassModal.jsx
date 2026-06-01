import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getList, createDoc } from '../api/frappe';
import { useAcademicYear } from '../context/AcademicYearContext';

export default function AssignClassModal({ isOpen, onClose, prefilledInstructor, prefilledInstructorName, onSuccess }) {
  const queryClient = useQueryClient();
  const { selectedYear } = useAcademicYear();
  const [form, setForm] = useState({
    course: '', student_group: '', instructor: prefilledInstructor || '',
    schedule_date: new Date().toISOString().split('T')[0],
    from_time: '09:00', to_time: '10:00', room: ''
  });

  const { data: options, isLoading: loading } = useQuery({
    queryKey: ['AssignClassModal', 'options', prefilledInstructor, selectedYear],
    queryFn: async () => {
      const groupFilters = selectedYear ? [['academic_year', '=', selectedYear]] : [];
      const [coursesData, groupsData, instructorsData] = await Promise.all([
        getList('Course', [], ['name', 'course_name'], 200).catch(() => []),
        getList('Student Group', groupFilters, ['name', 'student_group_name'], 200).catch(() => []),
        !prefilledInstructor ? getList('Instructor', [], ['name', 'instructor_name'], 500).catch(() => []) : Promise.resolve([]),
      ]);
      return { courses: coursesData, groups: groupsData, instructors: instructorsData };
    },
    enabled: isOpen,
  });

  const createMutation = useMutation({
    mutationFn: (payload) => createDoc('Course Schedule', payload),
    onSuccess: (newClass) => {
      queryClient.invalidateQueries({ queryKey: ['Course Schedule'] });
      onSuccess(newClass);
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.course || !form.student_group || !form.instructor || !form.schedule_date || !form.from_time || !form.to_time) {
      alert("Please fill out all required fields.");
      return;
    }
    // Resolve instructor_name from the list or the prefilled prop
    const selectedInstructor = instructors.find(i => i.name === form.instructor);
    const instructorName = selectedInstructor?.instructor_name || prefilledInstructorName || form.instructor;

    createMutation.mutate({
      course: form.course,
      student_group: form.student_group,
      instructor: form.instructor,
      instructor_name: instructorName,
      schedule_date: form.schedule_date,
      from_time: form.from_time + ':00',
      to_time: form.to_time + ':00',
      room: form.room
    });
  };

  if (!isOpen) return null;

  const courses = options?.courses || [];
  const groups = options?.groups || [];
  const instructors = options?.instructors || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-900">Assign Class</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors group">
            <span className="w-6 h-6 rounded-full bg-black/5 flex items-center justify-center transition-all duration-300 group-hover:bg-black/10">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </span>
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center py-10">
              <div className="w-8 h-8 border-2 border-[#2ED05D] border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-sm text-gray-500 font-medium">Loading courses...</p>
            </div>
          ) : (
            <form id="assign-class-form" onSubmit={handleSubmit} className="space-y-4">
              {!prefilledInstructor && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Instructor *</label>
                  <select value={form.instructor} onChange={e => setForm({...form, instructor: e.target.value})} className="input w-full bg-gray-50 text-sm" required>
                    <option value="">Select Instructor...</option>
                    {instructors.map(i => (
                      <option key={i.name} value={i.name}>{i.instructor_name || i.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Course *</label>
                  <select value={form.course} onChange={e => setForm({...form, course: e.target.value})} className="input w-full bg-gray-50 text-sm" required>
                    <option value="">Select Course...</option>
                    {courses.map(c => <option key={c.name} value={c.name}>{c.course_name || c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Student Group *</label>
                  <select value={form.student_group} onChange={e => setForm({...form, student_group: e.target.value})} className="input w-full bg-gray-50 text-sm" required>
                    <option value="">Select Group...</option>
                    {groups.map(g => <option key={g.name} value={g.name}>{g.student_group_name || g.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Date *</label>
                  <input type="date" value={form.schedule_date} onChange={e => setForm({...form, schedule_date: e.target.value})} className="input w-full bg-gray-50 text-sm" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Room</label>
                  <input type="text" value={form.room} onChange={e => setForm({...form, room: e.target.value})} className="input w-full bg-gray-50 text-sm" placeholder="e.g. Room 101" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">From Time *</label>
                  <input type="time" value={form.from_time} onChange={e => setForm({...form, from_time: e.target.value})} className="input w-full bg-gray-50 text-sm" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">To Time *</label>
                  <input type="time" value={form.to_time} onChange={e => setForm({...form, to_time: e.target.value})} className="input w-full bg-gray-50 text-sm" required />
                </div>
              </div>
            </form>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-600 hover:text-gray-900">Cancel</button>
          <button type="submit" form="assign-class-form" disabled={loading || createMutation.isPending}
            className="btn-primary text-sm px-6 py-2 shadow-sm flex items-center gap-2 group">
            {createMutation.isPending ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
            ) : 'Assign Class'}
          </button>
        </div>
      </div>
    </div>
  );
}
