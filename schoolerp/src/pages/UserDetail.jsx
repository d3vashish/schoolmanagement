import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDoc, getList, updateDoc, createDoc } from '../api/frappe';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AssignClassModal from '../components/AssignClassModal';
import AssignStudentGroupModal from '../components/AssignStudentGroupModal';

const Icons = {
  Back: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
  Mail: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  Phone: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
  Calendar: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  Clock: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  MapPin: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  Briefcase: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  CheckCircle: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  DollarSign: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Activity: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
  User: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Key: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>,
  Eye: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
  EyeOff: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
};

const MetricCard = ({ title, value, subtext, icon, color, bg }) => (
  <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-start gap-4">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${bg} ${color}`}>{icon}</div>
    <div>
      <p className="text-sm font-semibold text-gray-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-gray-900 leading-none">{value}</h3>
      {subtext && <p className="text-xs text-gray-400 mt-2 font-medium">{subtext}</p>}
    </div>
  </div>
);

const DetailRow = ({ icon, label, value }) => (
  <div className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
    <div className="text-gray-400 shrink-0">{icon}</div>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-gray-500 font-medium mb-0.5">{label}</p>
      <p className="text-sm text-gray-900 font-semibold truncate">{value || '—'}</p>
    </div>
  </div>
);

const fetchUserProfile = async (email) => {
  // Phase 1: Core user doc
  const userDoc = await getDoc('User', email);
  const roles = (userDoc.roles || []).map(r => r.role);
  const isInst = roles.includes('Instructor');
  const isAcc = roles.includes('Accountant');

  // Phase 2: Profile docs (parallel)
  const [instList, accList, empList] = await Promise.all([
    isInst ? getList('Instructor', [['user', '=', email]], ['name', 'instructor_name', 'department', 'employee']).catch(() => []) : Promise.resolve([]),
    isAcc ? getList('Accountant', [['user', '=', email]], ['name']).catch(() => []) : Promise.resolve([]),
    getList('Employee', [['user_id', '=', email]], ['name']).catch(() => [])
  ]);

  // Fetch actual docs
  let instDoc = null;
  if (instList && instList.length > 0) {
    instDoc = await getDoc('Instructor', instList[0].name).catch(() => null);
  } else if (isInst) {
    let matchedName = null;
    if (empList && empList.length > 0) {
      const instByEmp = await getList('Instructor', [['employee', '=', empList[0].name]], ['name']).catch(() => []);
      if (instByEmp && instByEmp.length > 0) matchedName = instByEmp[0].name;
    }
    if (!matchedName) {
      const fullName = `${userDoc.first_name || ''} ${userDoc.last_name || ''}`.trim().toLowerCase();
      const first = (userDoc.first_name || '').trim().toLowerCase();
      const allInst = await getList('Instructor', [], ['name', 'instructor_name', 'employee']).catch(() => []);
      const matched = allInst.find(i => {
        const n = (i.instructor_name || i.name || '').toLowerCase();
        if (!n || n.length < 3) return false;
        return n === fullName || (first && n === first) || (first && n.includes(first)) || (first && fullName.includes(n));
      });
      if (matched) matchedName = matched.name;
    }
    if (matchedName) instDoc = await getDoc('Instructor', matchedName).catch(() => null);
  }

  let accDoc = accList && accList.length > 0 ? await getDoc('Accountant', accList[0].name).catch(() => null) : null;
  let employeeId = instDoc?.employee || (empList && empList.length > 0 ? empList[0].name : null);
  let empDoc = employeeId ? await getDoc('Employee', employeeId).catch(() => null) : null;

  // Phase 3: Auxiliary data (parallel)
  let schedules = [], salaries = [], attendance = [], leaves = [];
  let studentGroups = [], assessmentPlans = [];
  const auxPromises = [];

  if (instDoc) {
    auxPromises.push(
      getList('Course Schedule', [['instructor', '=', instDoc.name]], ['name', 'course', 'student_group', 'schedule_date', 'from_time', 'to_time', 'room'], 200)
        .then(res => schedules = res).catch(() => { })
    );
    auxPromises.push(
      // Query Student Group Instructor child table directly (avoids N+1 getDoc calls)
      getList('Student Group Instructor', [['instructor', '=', instDoc.name]], ['parent'], 100)
        .then(rows => {
          const uniqueParents = [...new Set((rows || []).map(r => r.parent).filter(Boolean))];
          studentGroups = uniqueParents.map(name => ({ name }));
        }).catch(() => [])
    );
    auxPromises.push(
      getList('Assessment Plan', [], ['name', 'course', 'student_group']).then(res => {
        assessmentPlans = res || [];
      }).catch(() => { })
    );
  }

  if (employeeId) {
    auxPromises.push(
      getList('Salary Slip', [['employee', '=', employeeId]], ['name', 'start_date', 'end_date', 'net_pay', 'status', 'gross_pay'])
        .then(res => salaries = res).catch(() => { })
    );
    auxPromises.push(
      getList('Attendance', [['employee', '=', employeeId]], ['name', 'attendance_date', 'status'])
        .then(res => attendance = res).catch(() => { })
    );
    auxPromises.push(
      getList('Leave Application', [['employee', '=', employeeId]], ['name', 'from_date', 'to_date', 'leave_type', 'status'])
        .then(res => leaves = res).catch(() => { })
    );
  }

  await Promise.allSettled(auxPromises);

  return {
    user: userDoc, roles,
    instructor: instDoc, employee: empDoc, accountant: accDoc,
    schedules: schedules.sort((a, b) => new Date(a.schedule_date) - new Date(b.schedule_date)),
    salaries: salaries.sort((a, b) => new Date(b.start_date) - new Date(a.start_date)),
    attendance: attendance.sort((a, b) => new Date(b.attendance_date) - new Date(a.attendance_date)),
    leaves: leaves.sort((a, b) => new Date(b.from_date) - new Date(a.from_date)),
    studentGroups, assessmentPlans
  };
};

export default function UserDetail() {
  const { email } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [isAssigningClass, setIsAssigningClass] = useState(false);
  const [isAssigningGroup, setIsAssigningGroup] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('Overview');

  const { data, isLoading: loading } = useQuery({
    queryKey: ['UserDetail', email],
    queryFn: () => fetchUserProfile(email),
    enabled: !!email,
  });

  const profile = data || {
    user: null, roles: [],
    instructor: null, employee: null, accountant: null,
    schedules: [], salaries: [], attendance: [], leaves: [],
    studentGroups: [], assessmentPlans: []
  };

  const { user, roles, instructor, employee, schedules, salaries, attendance, leaves } = profile;

  const saveProfileMutation = useMutation({
    mutationFn: async (editForm) => {
      const userPayload = {
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        mobile_no: editForm.mobile_no,
        gender: editForm.gender,
        location: editForm.location,
        bio: editForm.bio
      };
      await updateDoc('User', email, userPayload);

      let newInst = profile.instructor;
      if (profile.instructor) {
        const instPayload = {
          department: editForm.department,
          employee: editForm.employee_link,
          status: editForm.instructor_status
        };
        await updateDoc('Instructor', profile.instructor.name, instPayload);
        newInst = { ...profile.instructor, ...instPayload };
      } else if (profile.roles.includes('Instructor')) {
        const instPayload = {
          instructor_name: `${editForm.first_name} ${editForm.last_name}`.trim(),
          department: editForm.department,
          employee: editForm.employee_link,
          status: editForm.instructor_status || 'Active'
        };
        try {
          const createdInst = await createDoc('Instructor', instPayload);
          newInst = createdInst;
        } catch (err) {
          console.warn('Could not create instructor:', err);
        }
      }

      let newEmp = profile.employee;
      if (profile.employee) {
        const empPayload = {
          department: editForm.department,
          cell_number: editForm.mobile_no,
          gender: editForm.gender,
          current_address: editForm.location
        };
        await updateDoc('Employee', profile.employee.name, empPayload);
        newEmp = { ...profile.employee, ...empPayload };
      } else if (editForm.employee_link) {
        try { newEmp = await getDoc('Employee', editForm.employee_link); } catch (err) { }
      }

      return { userPayload, newInst, newEmp };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['UserDetail', email] });
      setIsEditing(false);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (pwd) => updateDoc('User', email, { new_password: pwd }),
    onSuccess: () => {
      setShowPasswordModal(false);
      alert('Password updated successfully!');
    },
    onError: () => alert('Failed to reset password.'),
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
        <p className="text-gray-500 font-medium animate-pulse">Building Admin Dashboard...</p>
      </div>
    );
  }

  if (!user) return <div className="p-8 text-center text-red-500">Failed to load user.</div>;

  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.name;
  const initials = fullName.substring(0, 2).toUpperCase();
  const isInst = roles.includes('Instructor');

  const upcomingSchedules = schedules.filter(s => new Date(s.schedule_date) >= new Date(new Date().setHours(0, 0, 0, 0)));
  const todaySchedules = schedules.filter(s => s.schedule_date === new Date().toISOString().split('T')[0]);

  const presentDays = attendance.filter(a => a.status === 'Present').length;
  const totalAttDays = attendance.length;
  const attPct = totalAttDays > 0 ? Math.round((presentDays / totalAttDays) * 100) : 0;

  const tabs = ['Overview', 'HR & Payroll'];
  if (isInst) tabs.splice(1, 0, 'Academic Schedule');

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors font-medium">
          <Icons.Back /> <span className="text-sm">Back to Users</span>
        </button>
      </div>

      {/* Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-white shadow-sm border border-gray-200">
        <div className="h-40 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 relative">
          <div className="absolute inset-0 bg-white/10 pattern-grid-lg"></div>
        </div>

        <div className="px-8 pb-8 pt-20 relative">
          <div className="absolute -top-16 left-8 p-1.5 bg-white rounded-full shadow-md">
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 text-[#25B04E] flex items-center justify-center text-4xl font-bold border border-indigo-50">
              {user.user_image ? <img src={user.user_image} alt="" className="w-full h-full rounded-full object-cover" /> : initials}
            </div>
            <div className={`absolute bottom-3 right-3 w-5 h-5 rounded-full border-4 border-white ${user.enabled ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
          </div>

          <div className="flex flex-col md:flex-row md:justify-between md:items-start ml-0 mt-4 md:mt-0 md:ml-36 gap-4">
            <div>
              <div className="eyebrow">Profile</div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight -mt-1">{fullName}</h1>
              <p className="text-gray-500 text-base mt-1 font-medium flex items-center gap-2">
                <Icons.Briefcase />
                {employee?.designation || (isInst ? 'Instructor' : 'Staff Member')}
                {employee?.department && <span className="px-2 py-0.5 bg-gray-100 rounded text-xs ml-2 text-gray-600">{employee.department}</span>}
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                {roles.map(r => (
                  <span key={r} className="px-3 py-1 bg-[#E8F9ED] text-[#25B04E] text-xs font-bold rounded-lg border border-[#BBF7D0] uppercase tracking-wide">
                    {r}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => {
                setEditForm({
                  first_name: user.first_name || '', last_name: user.last_name || '',
                  mobile_no: user.mobile_no || employee?.cell_number || '',
                  gender: user.gender || employee?.gender || '',
                  location: user.location || employee?.current_address || '',
                  bio: user.bio || '',
                  department: instructor?.department || employee?.department || '',
                  employee_link: instructor?.employee || employee?.name || '',
                  instructor_status: instructor?.status || 'Active'
                });
                setIsEditing(true);
              }} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm font-semibold group">
                <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center transition-all duration-300 group-hover:bg-white/30 group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </span> Edit Profile
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isInst && (
          <MetricCard title="Upcoming Classes" value={upcomingSchedules.length} subtext={`${todaySchedules.length} classes today`} icon={<Icons.Calendar />} color="text-[#2ED05D]" bg="bg-[#E8F9ED]" />
        )}
        <MetricCard title="Attendance Score" value={`${attPct}%`} subtext={`${presentDays} days present this term`} icon={<Icons.CheckCircle />} color="text-emerald-600" bg="bg-emerald-50" />
        {employee && (
          <MetricCard title="Leave Balance" value={employee.leave_balance || '0'} subtext="Remaining paid leaves" icon={<Icons.Clock />} color="text-emerald-600" bg="bg-emerald-50" />
        )}
        {salaries.length > 0 && (
          <MetricCard title="Last Net Pay" value={`₹${salaries[0].net_pay.toLocaleString()}`} subtext={`Status: ${salaries[0].status}`} icon={<Icons.DollarSign />} color="text-rose-600" bg="bg-rose-50" />
        )}
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Identity & Contact</h3>
            </div>
            <div className="px-6 py-2">
              <DetailRow icon={<Icons.Mail />} label="Email Address" value={user.email} />
              <DetailRow icon={<Icons.Phone />} label="Mobile Number" value={user.mobile_no || employee?.cell_number} />
              <DetailRow icon={<Icons.User />} label="Gender" value={user.gender || employee?.gender} />
              <DetailRow icon={<Icons.MapPin />} label="Location" value={user.location || employee?.current_address} />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Login Credentials</h3>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="text-gray-400 shrink-0"><Icons.Mail /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 font-medium mb-0.5">Login Email</p>
                  <p className="text-sm text-gray-900 font-semibold">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-gray-400 shrink-0"><Icons.Key /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 font-medium mb-0.5">Password</p>
                  <p className="text-sm text-gray-400 italic">Hidden for security</p>
                </div>
              </div>
              <button
                onClick={() => { setNewPassword(''); setShowPassword(false); setShowPasswordModal(true); }}
                className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#E8F9ED] text-[#25B04E] text-sm font-bold rounded-xl border border-[#BBF7D0] hover:bg-[#ede9ff] transition-colors"
              >
                <Icons.Key />
                Reset Password
              </button>
            </div>
          </div>

          {(employee || instructor) && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Organization Details</h3>
              </div>
              <div className="px-6 py-2">
                <DetailRow icon={<Icons.Briefcase />} label="Employee ID" value={employee?.name || instructor?.employee} />
                <DetailRow icon={<Icons.Activity />} label="Department" value={employee?.department || instructor?.department} />
                <DetailRow icon={<Icons.Calendar />} label="Date of Joining" value={employee?.date_of_joining} />
                <DetailRow icon={<Icons.User />} label="Reports To" value={employee?.reports_to} />
              </div>
            </div>
          )}
        </div>

        {/* Right Content Area */}
        <div className="lg:col-span-2">
          <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto hide-scrollbar">
            {tabs.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 font-semibold text-sm whitespace-nowrap transition-colors relative ${activeTab === tab ? 'text-[#2ED05D]' : 'text-gray-500 hover:text-gray-800'}`}>
                {tab}
                {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2ED05D] rounded-t-full"></div>}
              </button>
            ))}
          </div>

          <div className="space-y-6">
            {activeTab === 'Overview' && (
              <>
                {profile.instructor && (
                  <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-5 flex items-center gap-2">
                      <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                      Connections
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Course Schedules</h4>
                          <button onClick={() => setIsAssigningClass(true)} className="text-xs font-bold text-[#2ED05D] hover:text-[#25B04E] flex items-center gap-1 group">
                            <span className="w-3.5 h-3.5 flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:translate-x-0.5 group-hover:-translate-y-[1px]">
                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            </span>
                            Assign Class
                          </button>
                        </div>
                        {profile.schedules.length === 0 ? (
                          <div className="text-sm text-gray-500 italic px-3 py-2 bg-gray-50 rounded-lg border border-dashed border-gray-200">No classes assigned</div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {profile.schedules.map(s => (
                              <div key={s.name} className="flex items-center justify-between px-3 py-2 bg-[#f8f9fa] rounded-lg border border-gray-100">
                                <div>
                                  <p className="text-sm font-semibold text-gray-800">{s.course}</p>
                                  <p className="text-xs text-gray-500">{s.student_group}</p>
                                </div>
                                <span className="text-xs font-medium text-gray-400">{s.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Class</h4>
                          <button onClick={() => setIsAssigningGroup(true)} className="text-xs font-bold text-[#2ED05D] hover:text-[#25B04E] flex items-center gap-1 group">
                            <span className="w-3.5 h-3.5 flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:translate-x-0.5 group-hover:-translate-y-[1px]">
                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            </span>
                            Assign Class
                          </button>
                        </div>
                        {profile.studentGroups.length === 0 ? (
                          <div className="text-sm text-gray-500 italic px-3 py-2 bg-gray-50 rounded-lg border border-dashed border-gray-200">No classes assigned</div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {profile.studentGroups.map(g => (
                              <div 
                                key={g.name} 
                                onClick={() => navigate(`/students?section=${encodeURIComponent(g.name)}`)}
                                className="flex items-center gap-2 px-3 py-2 bg-[#f8f9fa] rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors group"
                              >
                                <div className="w-6 h-6 rounded bg-[#BBF7D0] flex items-center justify-center flex-shrink-0 text-xs font-bold text-[#2ED05D]">
                                  {g.name.charAt(0)}
                                </div>
                                <span className="text-sm font-semibold text-gray-800 group-hover:text-[var(--color-primary)] transition-colors">{g.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {user.bio && (
                  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3">About</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">{user.bio}</p>
                  </div>
                )}

                {isInst && (
                  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Today's Agenda</h3>
                      <span className="px-3 py-1 bg-[#E8F9ED] text-[#25B04E] text-xs font-bold rounded-lg">{todaySchedules.length} Class</span>
                    </div>
                    {todaySchedules.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        <Icons.Calendar />
                        <p className="text-gray-500 mt-2 font-medium">No classes scheduled for today.</p>
                      </div>
                    ) : (
                      <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
                        {todaySchedules.map((s, i) => (
                          <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-[#BBF7D0] text-[#2ED05D] shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
                              <Icons.Clock />
                            </div>
                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-[#2ED05D]">{s.from_time?.substring(0, 5)} - {s.to_time?.substring(0, 5)}</span>
                                <span className="text-xs font-medium text-gray-400">{s.room || 'No Room'}</span>
                              </div>
                              <p className="font-semibold text-gray-900">{s.course}</p>
                              <p className="text-xs text-gray-500 mt-1">{s.student_group}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {activeTab === 'Academic Schedule' && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Upcoming Schedule</h3>
                  <button onClick={() => setIsAssigningClass(true)} className="btn-primary text-xs px-4 py-2 flex items-center gap-2 shadow-sm hover:shadow group">
                    <span className="w-3.5 h-3.5 rounded-full bg-white/20 flex items-center justify-center transition-all duration-300 group-hover:bg-white/30 group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </span>
                    Schedule Class
                  </button>
                </div>
                {upcomingSchedules.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 font-medium">No upcoming classes assigned.</div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 bg-white">
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Date</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Time</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Course / Section</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Room</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {upcomingSchedules.map((s, i) => (
                        <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4 font-medium text-gray-900">{s.schedule_date}</td>
                          <td className="px-6 py-4 text-gray-600 text-sm">{s.from_time?.substring(0, 5)} - {s.to_time?.substring(0, 5)}</td>
                          <td className="px-6 py-4">
                            <p className="font-semibold text-gray-900 text-sm">{s.course}</p>
                            <p className="text-xs text-gray-500">{s.student_group}</p>
                          </td>
                          <td className="px-6 py-4 text-gray-500 text-sm">{s.room || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === 'HR & Payroll' && (
              <div className="space-y-6">
                {!employee && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
                    <p className="text-emerald-800 font-bold mb-1">No Employee Record Found</p>
                    <p className="text-emerald-700 text-sm">Salary, leaves, and attendance data require an active Employee profile linked to this user's email.</p>
                  </div>
                )}

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Recent Salary Slips</h3>
                  </div>
                  {salaries.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 font-medium">No salary slips found.</div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-100 bg-white">
                          <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Period</th>
                          <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Gross Pay</th>
                          <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Net Pay</th>
                          <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {salaries.slice(0, 5).map((s, i) => (
                          <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4 text-gray-900 font-medium text-sm">{s.start_date} to {s.end_date}</td>
                            <td className="px-6 py-4 text-gray-600 text-sm">₹{s.gross_pay?.toLocaleString()}</td>
                            <td className="px-6 py-4 text-gray-900 font-bold text-sm">₹{s.net_pay?.toLocaleString()}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${s.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {s.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Leave Applications</h3>
                  </div>
                  {leaves.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 font-medium">No leave applications found.</div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-100 bg-white">
                          <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Date Range</th>
                          <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Leave Type</th>
                          <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {leaves.slice(0, 5).map((l, i) => (
                          <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4 text-gray-900 font-medium text-sm">{l.from_date} <span className="text-gray-400 mx-1">→</span> {l.to_date}</td>
                            <td className="px-6 py-4 text-gray-600 text-sm">{l.leave_type}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${l.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                                  l.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                {l.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">Edit Profile</h2>
              <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-gray-600 transition-colors group">
                <span className="w-6 h-6 rounded-full bg-black/5 flex items-center justify-center group-hover:bg-black/10">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </span>
              </button>
            </div>
            <div className="p-8 overflow-y-auto space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">First Name</label>
                  <input type="text" value={editForm.first_name} onChange={e => setEditForm({ ...editForm, first_name: e.target.value })} className="input w-full py-2.5 bg-gray-50 focus:bg-white transition-colors text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Last Name</label>
                  <input type="text" value={editForm.last_name} onChange={e => setEditForm({ ...editForm, last_name: e.target.value })} className="input w-full py-2.5 bg-gray-50 focus:bg-white transition-colors text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Mobile Number</label>
                  <input type="text" value={editForm.mobile_no} onChange={e => setEditForm({ ...editForm, mobile_no: e.target.value })} className="input w-full py-2.5 bg-gray-50 focus:bg-white transition-colors text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Gender</label>
                  <select value={editForm.gender} onChange={e => setEditForm({ ...editForm, gender: e.target.value })} className="input w-full py-2.5 bg-gray-50 focus:bg-white transition-colors text-sm">
                    <option value="">Select...</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Location</label>
                <input type="text" value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value })} className="input w-full py-2.5 bg-gray-50 focus:bg-white transition-colors text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Bio</label>
                <textarea value={editForm.bio} onChange={e => setEditForm({ ...editForm, bio: e.target.value })} rows="3" className="input w-full py-2.5 bg-gray-50 focus:bg-white transition-colors text-sm resize-none"></textarea>
              </div>
              {(profile.instructor || profile.employee || profile.roles.includes('Instructor')) && (
                <>
                  <div className="pt-4 mt-2 border-t border-gray-100">
                    <h3 className="text-xs font-bold text-[#2ED05D] uppercase tracking-wide mb-4">Organization Details</h3>
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Department</label>
                        <input type="text" value={editForm.department} onChange={e => setEditForm({ ...editForm, department: e.target.value })} className="input w-full py-2.5 bg-gray-50 focus:bg-white transition-colors text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Employee ID (Link)</label>
                        <input type="text" value={editForm.employee_link} onChange={e => setEditForm({ ...editForm, employee_link: e.target.value })} className="input w-full py-2.5 bg-gray-50 focus:bg-white transition-colors text-sm" placeholder="e.g. EMP-0001" />
                      </div>
                    </div>
                  </div>
                  {(profile.instructor || profile.roles.includes('Instructor')) && (
                    <div className="grid grid-cols-2 gap-5 mt-5">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Instructor Status</label>
                        <select value={editForm.instructor_status} onChange={e => setEditForm({ ...editForm, instructor_status: e.target.value })} className="input w-full py-2.5 bg-gray-50 focus:bg-white transition-colors text-sm">
                          <option value="Active">Active</option>
                          <option value="Left">Left</option>
                        </select>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="px-8 py-5 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
              <button onClick={() => setIsEditing(false)} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:text-gray-900 transition-colors">Cancel</button>
              <button disabled={saving || saveProfileMutation.isPending} onClick={() => saveProfileMutation.mutate(editForm)} className="btn-primary px-6 py-2.5 text-sm font-bold flex items-center gap-2">
                {(saving || saveProfileMutation.isPending) ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <AssignClassModal
        isOpen={isAssigningClass}
        onClose={() => setIsAssigningClass(false)}
        prefilledInstructor={profile.instructor?.name}
        prefilledInstructorName={profile.instructor?.instructor_name}
        onSuccess={(newClass) => {
          queryClient.invalidateQueries({ queryKey: ['UserDetail', email] });
        }}
      />
      <AssignStudentGroupModal
        isOpen={isAssigningGroup}
        onClose={() => setIsAssigningGroup(false)}
        instructorName={profile.instructor?.name}
        instructorFullName={profile.instructor?.instructor_name}
        onSuccess={(newGroup) => {
          queryClient.invalidateQueries({ queryKey: ['UserDetail', email] });
        }}
      />

      {/* Reset Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">Reset Password</h2>
              <button onClick={() => setShowPasswordModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors group">
                <span className="w-6 h-6 rounded-full bg-black/5 flex items-center justify-center group-hover:bg-black/10">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </span>
              </button>
            </div>
            <div className="p-8 space-y-5">
              <p className="text-sm text-gray-600">
                Set a new password for <span className="font-bold text-gray-900">{fullName}</span>.
              </p>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">New Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="input w-full py-2.5 pr-10 bg-gray-50 focus:bg-white transition-colors text-sm"
                    placeholder="Enter new password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <Icons.EyeOff /> : <Icons.Eye />}
                  </button>
                </div>
              </div>
            </div>
            <div className="px-8 py-5 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
              <button onClick={() => setShowPasswordModal(false)} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:text-gray-900 transition-colors">Cancel</button>
              <button disabled={resetPasswordMutation.isPending || !newPassword.trim()}
                onClick={() => resetPasswordMutation.mutate(newPassword)}
                className="btn-primary px-6 py-2.5 text-sm font-bold flex items-center gap-2">
                {resetPasswordMutation.isPending ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : 'Set Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
