import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useAcademicYear } from '../context/AcademicYearContext';
import { getList, getDoc, createDoc, updateDoc, deleteDoc, client } from '../api/frappe';
import { isAdmin, isTeacher, canManageStudents, canDeleteStudent, canManageStandards, canManageSections } from '../utils/roles';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Pagination from '../components/Pagination';
import { useFrappeList } from '../hooks/useFrappeQuery';
import EnrollStudentModal from '../components/fees/EnrollStudentModal';

export default function Students() {
  const { user } = useAuth();
  const settings = useSettings();
  const { selectedYear, isCurrentYear, yearGroups, yearPrograms } = useAcademicYear();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const roleCheck = { isAdmin, isTeacher, canManageStudents, canDeleteStudent, canManageStandards, canManageSections };

  // Admin-only: add standard / section
  const [showAddStandard, setShowAddStandard]   = useState(false);
  const [showAddSection, setShowAddSection]     = useState(false);
  const [newStandardName, setNewStandardName]   = useState('');
  const [newSectionName, setNewSectionName]     = useState('');
  const [newSectionTeacherId, setNewSectionTeacherId] = useState('');
  const [editSection, setEditSection]           = useState(null);
  const [savingStructure, setSavingStructure]   = useState(false);

  // Navigation
  const [view, setView]                         = useState('standards');
  const [selectedStandard, setSelectedStandard] = useState(null);
  const [selectedSection, setSelectedSection]   = useState(null);

  // Pagination
  const [studentPage, setStudentPage]           = useState(1);
  const STUDENTS_PER_PAGE = 20;

  // Student CRUD state
  const [search, setSearch]             = useState('');
  const [showModal, setShowModal]       = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [deleteConfirm, setDeleteConfirm]   = useState(null);
  const [enrollStudent, setEnrollStudent]   = useState(null);
  const [saving, setSaving]             = useState(false);

  const emptyForm = {
  first_name: '', last_name: '', gender: '', date_of_birth: '', blood_group: '',
  aadhar_number: '', student_email: '', student_mobile: '', address_line1: '', city: '', state: '',
  pincode: '', guardian_name: '', guardian_relation: '', guardian_mobile: '', guardian_email: '',
};
  const [formData, setFormData] = useState(emptyForm);

  // Fetch all Programs (standards) natively
  const { data: rawClassesData = {}, isLoading: loadingPrograms } = useQuery({
    queryKey: ['academic-classes'],
    queryFn: async () => {
      const res = await client.get('/academic/classes');
      return res.data;
    }
  });
  const rawClasses = Array.isArray(rawClassesData) ? rawClassesData : (rawClassesData.data || []);

  const { data: rawSectionsData = {}, isLoading: loadingSectionsData } = useQuery({
    queryKey: ['academic-sections'],
    queryFn: async () => {
      const res = await client.get('/academic/sections');
      return res.data;
    }
  });
  const rawSections = Array.isArray(rawSectionsData) ? rawSectionsData : (rawSectionsData.data || []);

  const { data: instructorsData = {}, isLoading: loadingInstructors } = useQuery({
    queryKey: ['staff-instructors'],
    queryFn: async () => {
      const res = await client.get('/academic/instructors');
      return res.data;
    }
  });
  const instructors = Array.isArray(instructorsData) ? instructorsData : (instructorsData.data || []);

  useEffect(() => {
    const sectionParam = searchParams.get('section');
    if (sectionParam && yearGroups?.length > 0 && view === 'standards') {
      const group = yearGroups.find(g => g.name === sectionParam || g.student_group_name === sectionParam);
      if (group) {
        setSelectedStandard({ name: group.program, label: group.program });
        setSelectedSection({ ...group, label: group.student_group_name?.split(' - ')[1] || group.name });
        setView('students');
      }
    }
  }, [searchParams, yearGroups, view]);

  const { data: teachingProfile, isLoading: loadingTeachingProfile } = useQuery({
    queryKey: ['my-teaching-profile'],
    queryFn: async () => {
      const res = await client.get('/academic/my-teaching-profile');
      return res.data;
    },
    enabled: roleCheck.isTeacher(user),
  });

  const teacherClasses = Array.from(
    (teachingProfile?.assignments || []).reduce((acc, a) => {
      if (!acc.has(a.class_id)) {
        acc.set(a.class_id, { name: a.class_name, label: a.class_name, count: new Set() });
      }
      acc.get(a.class_id).count.add(a.section_id);
      return acc;
    }, new Map()).values()
  ).map(c => ({ ...c, count: c.count.size }));

  const teacherSections = selectedStandard ? Array.from(
    (teachingProfile?.assignments || [])
      .filter(a => a.class_name === selectedStandard.name)
      .reduce((acc, a) => {
        if (!acc.has(a.section_id)) {
          acc.set(a.section_id, {
            name: a.section_id,
            label: a.section_name,
            program: a.class_name,
            student_group_name: a.section_name,
            teacher: null,
            teacherId: null,
          });
        }
        return acc;
      }, new Map()).values()
  ) : [];

  useEffect(() => {
    if (roleCheck.isTeacher(user) && teachingProfile?.assignments) {
      const uniqueSections = new Map();
      teachingProfile.assignments.forEach(a => {
        uniqueSections.set(a.section_id, a);
      });
      if (uniqueSections.size === 1 && view === 'standards' && !selectedStandard && !selectedSection) {
        const singleAssignment = Array.from(uniqueSections.values())[0];
        setSelectedStandard({ name: singleAssignment.class_name, label: singleAssignment.class_name });
        setSelectedSection({
          name: singleAssignment.section_id,
          label: singleAssignment.section_name,
          program: singleAssignment.class_name,
          student_group_name: singleAssignment.section_name
        });
        setView('students');
      }
    }
  }, [teachingProfile, user, view, selectedStandard, selectedSection]);

  // For admins: show ALL programs with section count
  const standards = roleCheck.isTeacher(user)
    ? teacherClasses
    : rawClasses.map(p => ({
        id: p.id,
        name: p.name || p.id,
        label: p.name,
        count: rawSections.filter(sg => sg.class_id === p.id).length,
      }));
  const loadingStandards = loadingPrograms || loadingTeachingProfile;

  // Derive sections
  const sections = !selectedStandard
    ? []
    : roleCheck.isTeacher(user)
      ? teacherSections
      : rawSections.filter(s => s.class_id === selectedStandard.id || s.class_id === selectedStandard.name || s.program === selectedStandard.name).map(s => ({
          ...s,
          id: s.id || s.name,
          label: s.name,
          teacher: instructors.find(i => i.user_id === s.class_teacher_id) ? `${instructors.find(i => i.user_id === s.class_teacher_id).first_name} ${instructors.find(i => i.user_id === s.class_teacher_id).last_name || ''}` : s.class_teacher_id || null,
          teacherId: s.class_teacher_id || null,
        }));
  const loadingSections = loadingSectionsData;

  // Fetch students
  const { data: studentsData, isLoading: loadingStudents, error: studentError } = useQuery({
    queryKey: ['Student', 'students', selectedSection?.id || selectedSection?.name, studentPage, search],
    queryFn: async () => {
      const sectionIdToUse = selectedSection?.id || selectedSection?.name;
      if (!sectionIdToUse) {
        console.warn('[Students] queryFn skipped: no section ID');
        return { data: [], total: 0, total_pages: 1 };
      }

      const params = new URLSearchParams({
        section_id: sectionIdToUse,
        page: String(studentPage),
        per_page: String(STUDENTS_PER_PAGE),
      });
      if (search) params.set('search', search);

      console.log('[Students] queryFn firing with params:', params.toString(), 'section:', sectionIdToUse);
      const res = await client.get(`/academic/students?${params}`);
      console.log('[Students] queryFn got response:', res.data);
      return res.data;
    },
    enabled: !!(selectedSection?.id || selectedSection?.name),
  });

  const students = studentsData?.data || [];
  const totalStudentPages = studentsData?.total_pages || 1;

  // Mutations
  const createStandardMutation = useMutation({
    mutationFn: (name) => client.post('/academic/classes', { name, order: 10 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-classes'] });
      setShowAddStandard(false); setNewStandardName('');
    },
  });

  const createSectionMutation = useMutation({
    mutationFn: (name) => client.post('/academic/sections', {
      class_id: selectedStandard.id || selectedStandard.name,
      name: name,
      capacity: 40,
      academic_year_id: selectedYear || settings?.academic_year || '00000000-0000-0000-0000-000000000000',
      class_teacher_id: newSectionTeacherId || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-sections'] });
      setShowAddSection(false); setNewSectionName(''); setNewSectionTeacherId('');
    },
  });

  const updateSectionMutation = useMutation({
    mutationFn: ({ sectionId, data }) => client.patch(`/academic/sections/${sectionId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-sections'] });
      setEditSection(null);
    },
  });

  const createStudentMutation = useMutation({
  mutationFn: async (data) => {
    const res = await client.post('/academic/students', {
      first_name: data.first_name,
      last_name: data.last_name || '',
      email: data.student_email || data.student_email_id || '',
      password: 'password123',
      aadhar_number: data.aadhar_number,
      date_of_birth: data.date_of_birth || null,
      guardian_name: data.guardian_name || null,
      guardian_phone: data.guardian_mobile || null,
      address: data.address_line1 || null,
      class_id: selectedSection?.class_id || null,
      section_id: selectedSection?.id || null,
      academic_year_id: selectedYear || null,
    });
    
    return res.data;
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['Student', 'students'] });
      setShowModal(false);
    },
    onError: (error) => {                                    // ← add this
      const detail = error.response?.data?.detail;
      alert(detail || 'Failed to create student');
    },
  });

  const updateStudentMutation = useMutation({
  mutationFn: ({ name, data }) => client.patch(`/academic/students/${name}`, {
    first_name: data.first_name,
    last_name: data.last_name,
    aadhar_number: data.aadhar_number || null,
    date_of_birth: data.date_of_birth || null,
    guardian_name: data.guardian_name || null,
    guardian_phone: data.guardian_mobile || null,
    address: data.address_line1 || null,
  }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['Student', 'students'] });
      setShowModal(false); setEditingStudent(null);
    },
  });

  const deleteStudentMutation = useMutation({
    mutationFn: (name) => client.delete(`/academic/students/${name}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['Student', 'students'] });
      setDeleteConfirm(null);
    },
  });

  const savingStudent = createStudentMutation.isPending || updateStudentMutation.isPending;

  const openAddModal = () => { setEditingStudent(null); setFormData(emptyForm); setShowModal(true); };

  const openEditModal = async (student) => {
  try {
    const s = await getDoc('Student', student.name);
    setEditingStudent(s);
    setFormData({
      first_name: s.first_name || '', last_name: s.last_name || '',
      gender: s.gender || '', date_of_birth: s.date_of_birth || '',
      blood_group: s.blood_group || '', aadhar_number: s.aadhar_number || '',
      student_email: s.student_email_id || '',
      student_mobile: s.student_mobile_number || '', address_line1: s.address_line_1 || '',
      city: s.city || '', state: s.state || '', pincode: s.pincode || '',
      guardian_name: s.guardians?.[0]?.guardian_name || '',
      guardian_relation: s.guardians?.[0]?.relation || '',
      guardian_mobile: s.guardians?.[0]?.mobile_number || '',
      guardian_email: s.guardians?.[0]?.email_address || '',
    });
      setShowModal(true);
    } catch (err) { console.error('Failed to fetch student details:', err); }
  };

  const handleSave = (e) => {
  e.preventDefault();
  if (!formData.first_name) { alert('First name is required'); return; }
  if (!formData.student_email) { alert('Student Email is required'); return; }
  if (!editingStudent && (!formData.aadhar_number || !/^\d{12}$/.test(formData.aadhar_number))) {
    alert('A valid 12-digit Aadhar number is required'); return;
  }

    const studentData = {
      first_name: formData.first_name,
      student_email_id: formData.student_email,
      aadhar_number: formData.aadhar_number || undefined,
      ...(formData.last_name && { last_name: formData.last_name }),
      ...(formData.gender && { gender: formData.gender }),
      ...(formData.date_of_birth && { date_of_birth: formData.date_of_birth }),
      ...(formData.blood_group && { blood_group: formData.blood_group }),
      ...(formData.student_mobile && { student_mobile_number: formData.student_mobile }),
      ...(formData.address_line1 && { address_line_1: formData.address_line1 }),
      ...(formData.city && { city: formData.city }),
      ...(formData.state && { state: formData.state }),
      ...(formData.pincode && { pincode: formData.pincode }),
      ...(formData.guardian_name && {
        guardians: [{
          doctype: 'Student Guardian',
          guardian_name: formData.guardian_name,
          relation: formData.guardian_relation || 'Others',
          mobile_number: formData.guardian_mobile || '',
          email_address: formData.guardian_email || '',
        }]
      }),
    };

    if (editingStudent) {
      updateStudentMutation.mutate({ name: editingStudent.name, data: studentData });
    } else {
      createStudentMutation.mutate(studentData);
    }
  };

  const handleDelete = () => {
    if (!deleteConfirm) return;
    deleteStudentMutation.mutate(deleteConfirm.name);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const goToSections = (standard) => {
    setSelectedStandard(standard);
    setView('sections');
  };

  const goToStudents = (section) => {
    console.log('[Students] goToStudents called with section:', { name: section.name, program: section.program, label: section.label, student_group_name: section.student_group_name });
    setSelectedSection(section);
    setView('students');
    setSearch('');
  };

  const navigateBreadcrumb = (level) => {
    if (level === 0) { setView('standards'); setSelectedStandard(null); setSelectedSection(null); }
    if (level === 1) { setView('sections'); setSelectedSection(null); }
  };

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow">People</div>
          <h1 className="text-3xl font-bold text-[var(--color-text)] -mt-1">Students</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">Manage student records</p>
        </div>

        {view === 'standards' && roleCheck.canManageStandards(user) && (
          <button onClick={() => setShowAddStandard(true)} className="btn-primary flex items-center gap-2 group">
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center transition-all duration-300 group-hover:bg-white/30 group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </span>
            Add Standard
          </button>
        )}

        {view === 'sections' && roleCheck.canManageSections(user) && (
          <button onClick={() => setShowAddSection(true)} className="btn-primary flex items-center gap-2 group">
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center transition-all duration-300 group-hover:bg-white/30 group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </span>
            Add Section
          </button>
        )}

        {view === 'students' && (
          <div className="flex items-center gap-3">
            <button onClick={() => queryClient.invalidateQueries({ queryKey: ['Student', 'students'] })}
              className="btn-secondary flex items-center gap-2 group">
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center transition-all duration-300 group-hover:bg-white/30 group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </span>
              Refresh
            </button>
            {roleCheck.canManageStudents(user) && (
              <button onClick={openAddModal} className="btn-primary flex items-center gap-2 group">
                <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center transition-all duration-300 group-hover:bg-white/30 group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </span>
                Add Student
              </button>
            )}
          </div>
        )}
      </div>

      {/* Breadcrumb */}
      {view !== 'standards' && (
        <nav className="flex items-center gap-2 text-sm">
          <button onClick={() => navigateBreadcrumb(0)} className="text-[var(--color-primary)] hover:underline font-medium">
            Standards
          </button>
          {selectedStandard && (
            <>
              <span className="text-gray-400">/</span>
              <button
                onClick={() => view === 'students' && navigateBreadcrumb(1)}
                className={view === 'students' ? 'text-[var(--color-primary)] hover:underline font-medium' : 'text-gray-700 font-semibold cursor-default'}
              >
                {selectedStandard.label}
              </button>
            </>
          )}
          {selectedSection && (
            <>
              <span className="text-gray-400">/</span>
              <span className="text-gray-700 font-semibold">{selectedSection.label || selectedSection.name}</span>
            </>
          )}
        </nav>
      )}

      {/* VIEW 1: Standards Grid */}
      {view === 'standards' && (
        <>
          {loadingStandards ? (
            <div className="flex items-center justify-center py-20">
              <span className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin"></span>
              <span className="ml-3 text-[var(--color-text-secondary)]">Loading standards...</span>
            </div>
          ) : roleCheck.isTeacher(user) && standards.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-text)] mb-1">No class assigned</h3>
              <p className="text-sm text-[var(--color-text-secondary)]">You have not been assigned as a class teacher yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {standards.map((std) => (
                <button key={std.name} onClick={() => goToSections(std)}
                  className="card flex flex-col items-center justify-center gap-3 p-6 hover:shadow-md hover:border-[var(--color-primary)] border-2 border-transparent transition-all cursor-pointer group text-center">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110"
                    style={{ background: 'rgba(59,130,246,0.1)' }}>
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                      <path d="M3 8C3 6.34 4.34 5 6 5H13L16 9H26C27.66 9 29 10.34 29 12V24C29 25.66 27.66 27 26 27H6C4.34 27 3 25.66 3 24V8Z"
                        fill="#2ED05D" fillOpacity="0.2" stroke="#2ED05D" strokeWidth="1.5" />
                      <path d="M3 13H29" stroke="#2ED05D" strokeWidth="1.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--color-text)] text-sm leading-tight">{std.label}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                      {std.count} {std.count === 1 ? 'section' : 'sections'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* VIEW 2: Sections Grid */}
      {view === 'sections' && (
        <>
          {loadingSections ? (
            <div className="flex items-center justify-center py-20">
              <span className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin"></span>
              <span className="ml-3 text-[var(--color-text-secondary)]">Loading sections...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {sections.map((sec) => (
                <div key={sec.name} onClick={() => goToStudents({ ...sec, label: sec.label || sec.name })}
                  className="card relative flex flex-col items-center justify-center gap-3 p-6 hover:shadow-md hover:border-[#2ED05D] border-2 border-transparent transition-all cursor-pointer group text-center">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110"
                    style={{ background: 'rgba(99,102,241,0.1)' }}>
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                      <rect x="3" y="3" width="22" height="22" rx="5" fill="#2ED05D" fillOpacity="0.15" stroke="#2ED05D" strokeWidth="1.5"/>
                      <path d="M8 10h12M8 14h12M8 18h7" stroke="#2ED05D" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--color-text)] text-sm">{sec.label || sec.name}</p>
                    {sec.teacher ? (
                      <p 
                        onClick={(e) => {
                          if (sec.teacherId) {
                            e.stopPropagation();
                            navigate(`/users/${sec.teacherId}`);
                          }
                        }}
                        className={`text-[11px] font-medium text-[#2ED05D] mt-1 truncate max-w-[120px] mx-auto ${sec.teacherId ? 'hover:underline cursor-pointer' : ''}`}
                      >
                        {sec.teacher}
                      </p>
                    ) : (
                      <p className="text-[11px] font-medium text-gray-400 mt-1">No Teacher</p>
                    )}
                  </div>
                  {roleCheck.canManageSections(user) && (
                    <button onClick={(e) => { e.stopPropagation(); setEditSection(sec); }} className="absolute top-2 right-2 p-1.5 hover:bg-gray-100 rounded-lg transition-colors group z-10" title="Edit Section">
                      <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* VIEW 3: Student List Table */}
      {view === 'students' && (
        <div className="card">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" placeholder="Search students..." value={search}
                onChange={(e) => setSearch(e.target.value)} className="input pl-12" />
            </div>
            <p className="text-sm text-[var(--color-text-secondary)]">{students.length} students</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-header">ID</th>
                  <th className="table-header">Name</th>
                  <th className="table-header">Gender</th>
                  <th className="table-header">DOB</th>
                  <th className="table-header">Email</th>
                  <th className="table-header">Mobile</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingStudents ? (
                  <tr>
                    <td colSpan={8} className="table-cell text-center py-12">
                      <span className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin inline-block"></span>
                      <span className="ml-2 text-[var(--color-text-secondary)]">Loading students...</span>
                    </td>
                  </tr>
                ) : studentError ? (
                  <tr>
                    <td colSpan={8} className="table-cell text-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-red-500 font-medium">Failed to load students</span>
                        <span className="text-sm text-[var(--color-text-secondary)]">{studentError.message}</span>
                        <button onClick={() => queryClient.invalidateQueries({ queryKey: ['Student', 'students'] })}
                          className="btn-secondary text-sm mt-2">Retry</button>
                      </div>
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="table-cell text-center py-12 text-[var(--color-text-secondary)]">
                      {search ? 'No students found' : `No students in this section.${roleCheck.canManageStudents(user) ? ' Click "Add Student" to enroll one.' : ''}`}
                    </td>
                  </tr>
                ) : (
                  students.map((student) => (
                    <tr key={student.name} onClick={() => navigate(`/students/${student.name}`)} className="hover:bg-gray-50 transition-colors cursor-pointer">
                      <td className="table-cell font-medium text-[var(--color-primary)]">{student.admission_number || student.name}</td>
                      <td className="table-cell font-medium">{student.first_name} {student.last_name}</td>
                      <td className="table-cell">{student.gender || '-'}</td>
                      <td className="table-cell">{student.date_of_birth || '-'}</td>
                      <td className="table-cell">{student.student_email_id || student.student_email || '-'}</td>
                      <td className="table-cell">{student.student_mobile_number || student.student_mobile || '-'}</td>
                      <td className="table-cell">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          student.enabled !== 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {student.enabled !== 0 ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="table-cell" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setEnrollStudent(student)} className="p-2 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer group" title="Enroll">
                            <span className="w-8 h-8 rounded-lg bg-transparent flex items-center justify-center transition-all duration-300 group-hover:bg-indigo-100/50 group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
                              <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </span>
                          </button>
                          {roleCheck.canManageStudents(user) && (
                            <button onClick={() => openEditModal(student)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer group" title="Edit">
                              <span className="w-8 h-8 rounded-lg bg-transparent flex items-center justify-center transition-all duration-300 group-hover:bg-gray-200/50 group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
                                <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </span>
                            </button>
                          )}
                          {roleCheck.canDeleteStudent(user) && (
                            <button onClick={() => setDeleteConfirm(student)} className="p-2 hover:bg-red-50 rounded-lg transition-colors cursor-pointer group" title="Delete">
                              <span className="w-8 h-8 rounded-lg bg-transparent flex items-center justify-center transition-all duration-300 group-hover:bg-red-100/50 group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
                                <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {totalStudentPages > 1 && (
            <Pagination page={studentPage} totalPages={totalStudentPages} onPageChange={setStudentPage} />
          )}
        </div>
      )}

      {/* Add Standard Modal */}
      {showAddStandard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--color-text)]">Add Standard</h2>
              <button onClick={() => { setShowAddStandard(false); setNewStandardName(''); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer group">
                <span className="w-6 h-6 rounded-full bg-black/5 flex items-center justify-center transition-all duration-300 group-hover:bg-black/10 group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </span>
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (newStandardName.trim()) createStandardMutation.mutate(newStandardName.trim()); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Standard Name <span className="text-red-500">*</span>
                </label>
                <input type="text" value={newStandardName} onChange={(e) => setNewStandardName(e.target.value)}
                  placeholder="e.g. 1st Standard" className="input" required autoFocus />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowAddStandard(false); setNewStandardName(''); }} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={createStandardMutation.isPending} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                  {createStandardMutation.isPending && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                  Add Standard
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Section Modal */}
      {showAddSection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-[var(--color-text)]">Add Section</h2>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">Under: <span className="font-medium">{selectedStandard?.label}</span></p>
              </div>
              <button onClick={() => { setShowAddSection(false); setNewSectionName(''); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer group">
                <span className="w-6 h-6 rounded-full bg-black/5 flex items-center justify-center transition-all duration-300 group-hover:bg-black/10 group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </span>
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (newSectionName.trim()) createSectionMutation.mutate(newSectionName.trim()); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Section Name <span className="text-red-500">*</span>
                </label>
                <input type="text" value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)}
                  placeholder="e.g. Section A" className="input" required autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Class Teacher (Optional)
                </label>
                <select value={newSectionTeacherId} onChange={(e) => setNewSectionTeacherId(e.target.value)} className="input">
                  <option value="">No Teacher</option>
                  {instructors.map(i => (
                    <option key={i.id} value={i.user_id}>{i.first_name} {i.last_name || ''}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowAddSection(false); setNewSectionName(''); }} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={createSectionMutation.isPending} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                  {createSectionMutation.isPending && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                  Add Section
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Section Modal */}
      {editSection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-[var(--color-text)]">Edit Section</h2>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">{editSection.label}</p>
              </div>
              <button onClick={() => setEditSection(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer group">
                <span className="w-6 h-6 rounded-full bg-black/5 flex items-center justify-center transition-all duration-300 group-hover:bg-black/10 group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </span>
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); updateSectionMutation.mutate({ sectionId: editSection.id || editSection.name, data: { class_teacher_id: editSection.teacherId || null } }); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Class Teacher (Optional)
                </label>
                <select value={editSection.teacherId || ''} onChange={(e) => setEditSection({ ...editSection, teacherId: e.target.value })} className="input">
                  <option value="">No Teacher</option>
                  {instructors.map(i => (
                    <option key={i.id} value={i.user_id}>{i.first_name} {i.last_name || ''}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditSection(null)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={updateSectionMutation.isPending} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                  {updateSectionMutation.isPending && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Student Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-[var(--color-text)]">{editingStudent ? 'Edit Student' : 'Add New Student'}</h2>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer group">
                  <span className="w-6 h-6 rounded-full bg-black/5 flex items-center justify-center transition-all duration-300 group-hover:bg-black/10 group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </span>
                </button>
              </div>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-2">First Name <span className="text-red-500">*</span></label>
                  <input type="text" name="first_name" value={formData.first_name} onChange={handleInputChange} className="input" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-2">Last Name</label>
                  <input type="text" name="last_name" value={formData.last_name} onChange={handleInputChange} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-2">Gender</label>
                  <select name="gender" value={formData.gender} onChange={handleInputChange} className="input">
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-2">Date of Birth</label>
                  <input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleInputChange} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                    Aadhar Number {!editingStudent && <span className="text-red-500">*</span>}
                  </label>
                  <input type="text" name="aadhar_number" value={formData.aadhar_number} onChange={handleInputChange}
                    maxLength={12} placeholder="12-digit Aadhar number" className="input" required={!editingStudent} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-2">Blood Group</label>
                  <select name="blood_group" value={formData.blood_group} onChange={handleInputChange} className="input">
                    <option value="">Select</option>
                    {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-2">Email <span className="text-red-500">*</span></label>
                  <input type="email" name="student_email" value={formData.student_email} onChange={handleInputChange} className="input" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-2">Mobile</label>
                  <input type="tel" name="student_mobile" value={formData.student_mobile} onChange={handleInputChange} className="input" />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">Address</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-2">Address</label>
                    <input type="text" name="address_line1" value={formData.address_line1} onChange={handleInputChange} className="input" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-2">City</label>
                    <input type="text" name="city" value={formData.city} onChange={handleInputChange} className="input" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-2">State</label>
                    <input type="text" name="state" value={formData.state} onChange={handleInputChange} className="input" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-2">Pincode</label>
                    <input type="text" name="pincode" value={formData.pincode} onChange={handleInputChange} className="input" />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">Guardian Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-2">Guardian Name</label>
                    <input type="text" name="guardian_name" value={formData.guardian_name} onChange={handleInputChange} className="input" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-2">Relationship</label>
                    <select name="guardian_relation" value={formData.guardian_relation} onChange={handleInputChange} className="input">
                      <option value="">Select</option>
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-2">Guardian Mobile</label>
                    <input type="tel" name="guardian_mobile" value={formData.guardian_mobile} onChange={handleInputChange} className="input" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-2">Guardian Email</label>
                    <input type="email" name="guardian_email" value={formData.guardian_email} onChange={handleInputChange} className="input" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={savingStudent} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                  {savingStudent && <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                  {editingStudent ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enroll Student Modal */}
      {enrollStudent && (
        <EnrollStudentModal
          student={enrollStudent}
          onClose={() => setEnrollStudent(null)}
          onEnrolled={() => {
            setEnrollStudent(null);
            queryClient.invalidateQueries({ queryKey: ['Program Enrollment'] });
            queryClient.invalidateQueries({ queryKey: ['Program Enrollments'] });
          }}
        />
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--color-text)]">Delete Student</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-[var(--color-text)] mb-6">
              Are you sure you want to delete <strong>{deleteConfirm.student_name || deleteConfirm.first_name}</strong>?
            </p>
            <div className="flex items-center justify-end gap-4">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">Cancel</button>
              <button onClick={handleDelete} disabled={deleteStudentMutation.isPending} className="px-6 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors cursor-pointer">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
