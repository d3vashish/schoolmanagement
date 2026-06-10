import re
with open('src/pages/Students.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. State additions
content = content.replace(
    "const [newSectionName, setNewSectionName]     = useState('');",
    "const [newSectionName, setNewSectionName]     = useState('');\n  const [newSectionTeacherId, setNewSectionTeacherId] = useState('');\n  const [editSection, setEditSection]           = useState(null);"
)

# 2. Raw queries instead of useFrappeList
content = content.replace(
    """  // Fetch all Programs (standards) so admins see them even without groups
  const { data: allPrograms = [], isLoading: loadingPrograms } = useFrappeList(
    'Program', [], ['name', 'program_name'], 200
  );""",
    """  // Fetch all Programs (standards) natively
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
      const res = await client.get('/staff/instructors');
      return res.data;
    }
  });
  const instructors = Array.isArray(instructorsData) ? instructorsData : (instructorsData.data || []);"""
)

# 3. standards and sections derivation
content = content.replace(
    """  // For admins: show ALL programs with section count from yearGroups
  // For teachers: show only their assigned programs
  const standards = roleCheck.isTeacher(user)
    ? teacherClasses
    : allPrograms.map(p => ({
        name: p.program_name || p.name,
        label: p.program_name || p.name,
        count: yearGroups.filter(sg => sg.program === (p.program_name || p.name)).length,
      }));
  const loadingStandards = loadingPrograms || loadingTeachingProfile;

  // Derive sections from shared yearGroups
  const sections = !selectedStandard
    ? []
    : roleCheck.isTeacher(user)
      ? teacherSections
      : yearGroups.filter(g => g.program === selectedStandard.name).map(s => ({
          ...s,
          label: s.student_group_name?.split(' - ')[1] || s.student_group_name || s.name,
          teacher: s.class_teacher || s.instructors?.[0]?.instructor_name || null,
          teacherId: s.class_teacher || null,
        }));
  const loadingSections = false;""",
    """  // For admins: show ALL programs with section count
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
          teacher: instructors.find(i => i.id === s.class_teacher_id)?.instructor_name || s.class_teacher_id || null,
          teacherId: s.class_teacher_id || null,
        }));
  const loadingSections = loadingSectionsData;"""
)

# 4. Mutations
content = content.replace(
    """  const createStandardMutation = useMutation({
    mutationFn: (name) => createDoc('Program', { program_name: name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['Student', 'standards'] });
      setShowAddStandard(false); setNewStandardName('');
    },
  });

  const createSectionMutation = useMutation({
    mutationFn: (name) => createDoc('Student Group', {
      student_group_name: `${selectedStandard.name} - ${name}`,
      program: selectedStandard.name,
      group_based_on: 'Batch',
      academic_year: selectedYear || settings?.academic_year || '',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['Student Group', 'list'] });
      setShowAddSection(false); setNewSectionName('');
    },
  });""",
    """  const createStandardMutation = useMutation({
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
  });"""
)

# 5. UI Updates
content = content.replace(
    """                <input type="text" value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)}
                  placeholder="e.g. Section A" className="input" required autoFocus />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">""",
    """                <input type="text" value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)}
                  placeholder="e.g. Section A" className="input" required autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Class Teacher (Optional)
                </label>
                <select value={newSectionTeacherId} onChange={(e) => setNewSectionTeacherId(e.target.value)} className="input">
                  <option value="">No Teacher</option>
                  {instructors.map(i => (
                    <option key={i.id} value={i.id}>{i.instructor_name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">"""
)

content = content.replace(
    """                    <p className="font-semibold text-[var(--color-text)] text-sm">{sec.label || sec.name}</p>
                    {sec.teacher && (
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
                    )}
                  </div>
                </button>""",
    """                    <p className="font-semibold text-[var(--color-text)] text-sm">{sec.label || sec.name}</p>
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
                </button>"""
)

# 6. Add Edit Section Modal
content = content.replace(
    """      {/* Add / Edit Student Modal */}""",
    """      {/* Edit Section Modal */}
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
                    <option key={i.id} value={i.id}>{i.instructor_name}</option>
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

      {/* Add / Edit Student Modal */}"""
)

# 7. Add `relative` to the section card
content = content.replace(
    """className="card flex flex-col items-center justify-center gap-3 p-6 hover:shadow-md hover:border-[#2ED05D] border-2 border-transparent transition-all cursor-pointer group text-center">""",
    """className="card relative flex flex-col items-center justify-center gap-3 p-6 hover:shadow-md hover:border-[#2ED05D] border-2 border-transparent transition-all cursor-pointer group text-center">"""
)

with open('src/pages/Students.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patch complete")
