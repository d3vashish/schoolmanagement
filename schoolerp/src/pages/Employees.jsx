import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { getStaffList, getStaffLeaves, applyLeave, approveLeave, getStaffAttendance } from '../api/frappe';
import Pagination from '../components/Pagination';

const AVATAR_COLORS = [
  { from: '#2ED05D', to: '#E07028' },
  { from: '#6C8EBF', to: '#4A6FA5' },
  { from: '#B877D9', to: '#9A5FC4' },
  { from: '#F06A6A', to: '#D94A4A' },
  { from: '#5CB8A0', to: '#3D9E86' },
  { from: '#E8A060', to: '#D08848' },
  { from: '#A08CD6', to: '#826DC4' },
  { from: '#60B0E8', to: '#4890D0' },
];

const ROLE_PALETTE = [
  'bg-[#E8F9ED] text-[#25B04E]',
  'bg-emerald-50 text-emerald-700',
  'bg-rose-50 text-rose-700',
  'bg-cyan-50 text-cyan-700',
  'bg-purple-50 text-purple-700',
  'bg-blue-50 text-blue-700',
  'bg-amber-50 text-amber-700',
];

const ROLE_CACHE = {};
let colorIdx = 0;
const roleColor = (role) => {
  if (!ROLE_CACHE[role]) {
    ROLE_CACHE[role] = ROLE_PALETTE[colorIdx % ROLE_PALETTE.length];
    colorIdx++;
  }
  return ROLE_CACHE[role];
};

const getInitials = (first, last) => {
  const a = (first || '')[0] || '';
  const b = (last || '')[0] || '';
  return (a + b).toUpperCase() || '?';
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

const STATUS_STYLE = {
  Present: { pill: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: '✓', label: 'Present' },
  Absent: { pill: 'bg-red-100 text-red-700 border-red-200', icon: '✗', label: 'Absent' },
  Leave: { pill: 'bg-amber-100 text-amber-700 border-amber-200', icon: '◷', label: 'Leave' },
};

const LEAVE_STATUS_STYLE = {
  Approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Rejected: 'bg-red-100 text-red-700 border-red-200',
  Pending: 'bg-amber-100 text-amber-700 border-amber-200',
  Cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

const today = () => new Date().toISOString().split('T')[0];

export default function Employees() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.roles?.includes('super_admin') || user?.roles?.includes('principal');

  const [tab, setTab] = useState('directory');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [view, setView] = useState('grid');

  // Leave state
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ staff_id: '', leave_type: 'Sick Leave', start_date: '', end_date: '', reason: '' });

  // Attendance state
  const [attendanceStaff, setAttendanceStaff] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(today());
  const [attendanceRange, setAttendanceRange] = useState('week');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // ── Data ──

  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ['employees', 'directory'],
    queryFn: getStaffList,
  });

  const { data: allLeaves = [], isLoading: loadingLeaves } = useQuery({
    queryKey: ['employees', 'leaves'],
    queryFn: () => getStaffLeaves(),
    enabled: tab === 'leave',
  });

  const { data: attendanceRecords = [], isLoading: loadingAttendance } = useQuery({
    queryKey: ['employees', 'attendance', attendanceStaff, attendanceRange],
    queryFn: () => {
      const end = today();
      let start;
      if (attendanceRange === 'week') {
        const d = new Date(); d.setDate(d.getDate() - 6); start = d.toISOString().split('T')[0];
      } else {
        const d = new Date(); d.setDate(d.getDate() - 29); start = d.toISOString().split('T')[0];
      }
      return getStaffAttendance(attendanceStaff, start, end);
    },
    enabled: tab === 'attendance',
  });

  // ── Mutations ──

  const applyLeaveMutation = useMutation({
    mutationFn: (data) => applyLeave(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', 'leaves'] });
      setShowLeaveModal(false);
      setLeaveForm({ staff_id: '', leave_type: 'Sick Leave', start_date: '', end_date: '', reason: '' });
      showToast('Leave applied successfully!');
    },
    onError: (err) => showToast(err.message || 'Failed to apply leave'),
  });

  const approveLeaveMutation = useMutation({
    mutationFn: ({ id, status }) => approveLeave(id, status, user?.email || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', 'leaves'] });
      showToast('Leave status updated');
    },
    onError: (err) => showToast(err.message || 'Failed to update leave'),
  });

  // ── Filtered Data ──

  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];
  const roles = [...new Set(employees.map(e => e.role).filter(Boolean))];

  const filteredEmployees = employees.filter(e => {
    if (roleFilter && e.role !== roleFilter) return false;
    if (deptFilter && e.department !== deptFilter) return false;
    if (statusFilter === 'active' && !e.is_active) return false;
    if (statusFilter === 'inactive' && e.is_active) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (e.full_name || '').toLowerCase().includes(q)
      || (e.email || '').toLowerCase().includes(q)
      || (e.department || '').toLowerCase().includes(q)
      || (e.employee_id || '').toLowerCase().includes(q);
  });

  const PER_PAGE = 12;
  const totalPages = Math.ceil(filteredEmployees.length / PER_PAGE);
  const paginated = filteredEmployees.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // ── Employee Profile ──

  if (selectedEmployee) {
    const emp = selectedEmployee;
    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-16">
        {toast && (
          <div className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl text-sm font-semibold bg-[#2D2A24] text-white shadow-[0_8px_32px_rgba(0,0,0,0.2)] animate-fade-in-up">
            {toast}
          </div>
        )}
        <button onClick={() => { setSelectedEmployee(null); setTab('directory'); }}
          className="flex items-center gap-2 text-sm font-semibold text-[#8A8680] hover:text-[#2D2A24] transition-colors cursor-pointer">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Directory
        </button>

        <div className="bg-white rounded-[28px] border border-[#f1f5f9] shadow-[0_2px_8px_rgba(0,0,0,0.02)] p-8">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="w-[80px] h-[80px] rounded-[20px] flex items-center justify-center text-white font-extrabold text-2xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)] ring-[3px] ring-white/60 shrink-0"
              style={{ backgroundImage: 'linear-gradient(135deg, #2ED05D, #22C55E)' }}>
              {getInitials(emp.first_name, emp.last_name)}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-extrabold text-[#2D2A24]">{emp.full_name}</h2>
              <p className="text-[#8A8680] font-medium mt-1">{emp.email}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-[8px] ${roleColor(emp.role)}`}>{emp.role}</span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-[8px] ${emp.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {emp.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
            {[
              { label: 'Employee ID', value: emp.employee_id || '—' },
              { label: 'Department', value: emp.department || '—' },
              { label: 'Qualification', value: emp.qualification || '—' },
              { label: 'Phone', value: emp.phone || '—' },
              { label: 'Email', value: emp.email || '—' },
              { label: 'Role', value: emp.role || '—' },
            ].map(field => (
              <div key={field.label} className="bg-[#F7F9FC] rounded-2xl px-4 py-3">
                <p className="text-xs font-semibold text-[#8A8680] uppercase tracking-wide">{field.label}</p>
                <p className="text-sm font-bold text-[#2D2A24] mt-1 break-all">{field.value}</p>
              </div>
            ))}
          </div>

          {/* Profile action buttons */}
          <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t border-[#f1f5f9]">
            <button onClick={() => { setSelectedEmployee(null); setTab('leave'); }}
              className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[#E8F9ED] text-[#25B04E] hover:bg-[#D1FAE5] transition-colors cursor-pointer">
              Apply Leave
            </button>
            <button onClick={() => { setSelectedEmployee(null); setTab('attendance'); }}
              className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[#FFF7ED] text-[#C2410C] hover:bg-[#FFEDD5] transition-colors cursor-pointer">
              View Attendance
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl text-sm font-semibold bg-[#2D2A24] text-white shadow-[0_8px_32px_rgba(0,0,0,0.2)] animate-fade-in-up">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="eyebrow">HR</div>
          <h1 className="text-[2rem] sm:text-[2.5rem] font-extrabold text-[#2D2A24] tracking-tight leading-[1.1] -mt-1">Employees</h1>
          <p className="text-[#8A8680] mt-2 font-medium text-sm">{employees.length} total employees</p>
        </div>
        <button onClick={() => queryClient.invalidateQueries({ queryKey: ['employees'] })}
          className="p-2.5 bg-white border border-[#e2e8f0] shadow-[0_1px_3px_rgba(0,0,0,0.04)] rounded-xl transition-[color,background-color,transform,box-shadow] duration-200 hover:bg-[#E8F9ED] hover:border-[#BBF7D0] hover:text-[#2ED05D] cursor-pointer text-[#8A8680] active:scale-[0.95] group" title="Refresh">
          <svg className={`w-5 h-5 transition-transform duration-300 group-hover:rotate-180 ${loadingEmployees ? 'animate-spin text-[#2ED05D]' : ''}`} style={{ animationDuration: '1s' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex rounded-xl overflow-hidden border border-gray-200 w-fit shadow-sm flex-wrap">
        {[
          { k: 'directory', label: '📋 Directory' },
          { k: 'leave', label: '📅 Leave Management' },
          { k: 'attendance', label: '⏱ Attendance' },
        ].map(({ k, label }) => (
          <button key={k} onClick={() => { setTab(k); setPage(1); }}
            className={`px-5 py-2.5 text-sm font-medium transition-all ${
              tab === k ? 'bg-[var(--color-primary)] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          DIRECTORY TAB
          ═══════════════════════════════════════════════════════════ */}
      {tab === 'directory' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8680]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" placeholder="Search employees..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="input py-2.5 pl-[38px] pr-4 w-56 sm:w-64 text-sm font-medium text-[#2D2A24] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#e2e8f0] transition-[border-color,box-shadow] duration-200 placeholder:text-[#B0ABA4] focus:border-[#2ED05D] focus:shadow-[0_0_0_3px_rgba(46,208,93,0.12)]" />
            </div>

            <div className="relative">
              <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
                className="input py-2.5 pl-3 pr-8 text-sm font-medium text-[#2D2A24] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#e2e8f0] appearance-none cursor-pointer transition-[border-color,box-shadow] duration-200 focus:border-[#2ED05D]">
                <option value="">All Roles</option>
                {roles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="relative">
              <select value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setPage(1); }}
                className="input py-2.5 pl-3 pr-8 text-sm font-medium text-[#2D2A24] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#e2e8f0] appearance-none cursor-pointer transition-[border-color,box-shadow] duration-200 focus:border-[#2ED05D]">
                <option value="">All Departments</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div className="relative">
              <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                className="input py-2.5 pl-3 pr-8 text-sm font-medium text-[#2D2A24] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#e2e8f0] appearance-none cursor-pointer transition-[border-color,box-shadow] duration-200 focus:border-[#2ED05D]">
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="flex rounded-lg overflow-hidden border border-gray-200 ml-auto">
              <button onClick={() => setView('grid')}
                className={`p-2 transition-colors ${view === 'grid' ? 'bg-[#2ED05D] text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button onClick={() => setView('table')}
                className={`p-2 transition-colors ${view === 'table' ? 'bg-[#2ED05D] text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {loadingEmployees ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-[var(--color-text-secondary)]">Loading employees…</span>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-[28px] border border-[#f1f5f9]">
              <div className="w-[72px] h-[72px] rounded-[20px] bg-[#E8F9ED] flex items-center justify-center mb-5">
                <svg className="w-8 h-8 text-[#2ED05D]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-[#2D2A24] mb-1">No employees found</h3>
              <p className="text-sm font-medium text-[#8A8680]">Try adjusting your search or filters.</p>
            </div>
          ) : view === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {paginated.map((emp, i) => {
                const colors = AVATAR_COLORS[i % AVATAR_COLORS.length];
                return (
                  <div key={emp.id}
                    className="group relative bg-white rounded-[28px] p-7 border border-[#f1f5f9]/80 shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-[border-color,transform,box-shadow] duration-200 hover:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.06)] hover:border-[#BBF7D0] cursor-pointer flex flex-col min-h-[280px] active:scale-[0.98]"
                    onClick={() => setSelectedEmployee(emp)}>
                    <div className="flex items-start justify-between mb-5">
                      <div className="w-[56px] h-[56px] rounded-[16px] flex items-center justify-center text-white font-extrabold text-xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)] ring-[3px] ring-white/60 shrink-0"
                        style={{ backgroundImage: `linear-gradient(135deg, ${colors.from}, ${colors.to})` }}>
                        {getInitials(emp.first_name, emp.last_name)}
                      </div>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#f1f5f9]/50">
                        <span className={`w-[6px] h-[6px] rounded-full ${emp.is_active ? 'bg-emerald-500' : 'bg-red-400'}`} />
                        <span className="text-[10px] font-bold text-[#8A8680] uppercase tracking-wider">{emp.is_active ? 'Active' : 'Inactive'}</span>
                      </div>
                    </div>
                    <div className="mb-4">
                      <h3 className="font-extrabold text-[#2D2A24] text-[17px] leading-tight tracking-tight truncate">{emp.full_name}</h3>
                      <p className="text-sm font-medium text-[#8A8680] truncate mt-0.5">{emp.email}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-3 flex-1 content-start">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-[8px] ${roleColor(emp.role)}`}>{emp.role}</span>
                      {emp.department && (
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-[8px] bg-blue-50 text-blue-700">{emp.department}</span>
                      )}
                      {emp.employee_id && (
                        <span className="text-[11px] font-medium px-2.5 py-1 rounded-[8px] bg-gray-100 text-gray-600">ID: {emp.employee_id}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-[#f1f5f9]">
                      <span className="text-sm font-semibold text-[#B0ABA4] transition-colors duration-200 group-hover:text-[#2ED05D] flex items-center gap-1.5">
                        View Profile
                        <svg className="w-3.5 h-3.5 transition-[opacity,transform] duration-200 -translate-x-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-[28px] border border-[#f1f5f9] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#F7F9FC] border-b border-[#f1f5f9]">
                      <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase tracking-wider">Employee</th>
                      <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase tracking-wider">Email</th>
                      <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase tracking-wider">Department</th>
                      <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase tracking-wider">Role</th>
                      <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase tracking-wider">Employee ID</th>
                      <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9]">
                    {paginated.map(emp => (
                      <tr key={emp.id} onClick={() => setSelectedEmployee(emp)}
                        className="hover:bg-[#F7F9FC]/50 cursor-pointer transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-[10px] bg-[#E8F9ED] flex items-center justify-center text-[#2ED05D] font-bold text-sm">{getInitials(emp.first_name, emp.last_name)}</div>
                            <span className="font-semibold text-[#2D2A24]">{emp.full_name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-[#8A8680]">{emp.email}</td>
                        <td className="px-5 py-4">
                          {emp.department ? (
                            <span className="text-xs font-semibold px-2 py-1 rounded-[6px] bg-blue-50 text-blue-700">{emp.department}</span>
                          ) : '—'}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-xs font-bold px-2 py-1 rounded-[6px] ${roleColor(emp.role)}`}>{emp.role}</span>
                        </td>
                        <td className="px-5 py-4 text-[#8A8680] font-mono text-xs">{emp.employee_id || '—'}</td>
                        <td className="px-5 py-4">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-[6px] ${emp.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                            {emp.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════
          LEAVE MANAGEMENT TAB
          ═══════════════════════════════════════════════════════════ */}
      {tab === 'leave' && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm font-medium text-[#8A8680]">{allLeaves.length} total leave records</p>
            <button onClick={() => setShowLeaveModal(true)}
              className="btn-primary px-5 py-2.5 text-sm font-bold flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Apply Leave
            </button>
          </div>

          {loadingLeaves ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-[var(--color-text-secondary)]">Loading leaves…</span>
            </div>
          ) : allLeaves.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-[28px] border border-[#f1f5f9]">
              <div className="text-5xl mb-4">📅</div>
              <h3 className="text-lg font-bold text-[#2D2A24] mb-1">No leave records</h3>
              <p className="text-sm font-medium text-[#8A8680]">Apply for leave to see records here.</p>
            </div>
          ) : (
            <div className="bg-white rounded-[28px] border border-[#f1f5f9] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#F7F9FC] border-b border-[#f1f5f9]">
                      <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase tracking-wider">Staff</th>
                      <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase tracking-wider">Type</th>
                      <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase tracking-wider">From</th>
                      <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase tracking-wider">To</th>
                      <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase tracking-wider">Reason</th>
                      <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase tracking-wider">Status</th>
                      {isAdmin && <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase tracking-wider">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9]">
                    {allLeaves.map(leave => (
                      <tr key={leave.id} className="hover:bg-[#F7F9FC]/50 transition-colors">
                        <td className="px-5 py-4 font-semibold text-[#2D2A24]">{leave.staff_name || leave.staff_id || '—'}</td>
                        <td className="px-5 py-4">
                          <span className="text-xs font-semibold px-2 py-1 rounded-[6px] bg-purple-50 text-purple-700">{leave.leave_type}</span>
                        </td>
                        <td className="px-5 py-4 text-[#8A8680]">{fmtDate(leave.start_date)}</td>
                        <td className="px-5 py-4 text-[#8A8680]">{fmtDate(leave.end_date)}</td>
                        <td className="px-5 py-4 text-[#8A8680] max-w-[200px] truncate" title={leave.reason}>{leave.reason || '—'}</td>
                        <td className="px-5 py-4">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${LEAVE_STATUS_STYLE[leave.status] || 'bg-gray-100 text-gray-600'}`}>
                            {leave.status}
                          </span>
                        </td>
                        {isAdmin && leave.status === 'Pending' && (
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <button onClick={() => approveLeaveMutation.mutate({ id: leave.id, status: 'Approved' })}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer">
                                Approve
                              </button>
                              <button onClick={() => approveLeaveMutation.mutate({ id: leave.id, status: 'Rejected' })}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors cursor-pointer">
                                Reject
                              </button>
                            </div>
                          </td>
                        )}
                        {isAdmin && leave.status !== 'Pending' && (
                          <td className="px-5 py-4">
                            <span className="text-xs text-[#8A8680]">{leave.approved_by ? `by ${leave.approved_by}` : '—'}</span>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════
          ATTENDANCE TAB
          ═══════════════════════════════════════════════════════════ */}
      {tab === 'attendance' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Staff Member</label>
              <select value={attendanceStaff} onChange={e => setAttendanceStaff(e.target.value)}
                className="input text-sm min-w-[200px]">
                <option value="">All Staff</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Period</label>
              <div className="flex rounded-xl overflow-hidden border border-gray-200">
                {[{ k: 'week', label: 'Week' }, { k: 'month', label: 'Month' }].map(({ k, label }) => (
                  <button key={k} onClick={() => setAttendanceRange(k)}
                    className={`px-4 py-2 text-xs font-bold transition-all ${
                      attendanceRange === k ? 'bg-[var(--color-primary)] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loadingAttendance ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-[var(--color-text-secondary)]">Loading attendance…</span>
            </div>
          ) : attendanceRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-[28px] border border-[#f1f5f9]">
              <div className="text-5xl mb-4">⏱</div>
              <h3 className="text-lg font-bold text-[#2D2A24] mb-1">No attendance records</h3>
              <p className="text-sm font-medium text-[#8A8680]">Attendance data will appear here once recorded.</p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-4">
                {(() => {
                  const total = attendanceRecords.length;
                  const present = attendanceRecords.filter(r => r.status === 'Present').length;
                  const absent = attendanceRecords.filter(r => r.status === 'Absent').length;
                  const leave = attendanceRecords.filter(r => r.status === 'Leave').length;
                  return [
                    { label: 'Present', value: present, pct: total ? Math.round(present / total * 100) : 0, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                    { label: 'Absent', value: absent, pct: total ? Math.round(absent / total * 100) : 0, color: 'bg-red-50 text-red-700 border-red-200' },
                    { label: 'Leave', value: leave, pct: total ? Math.round(leave / total * 100) : 0, color: 'bg-amber-50 text-amber-700 border-amber-200' },
                  ].map(s => (
                    <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
                      <p className="text-2xl font-bold">{s.value}</p>
                      <p className="text-xs font-medium opacity-70 mt-1">{s.label} ({s.pct}%)</p>
                    </div>
                  ));
                })()}
              </div>

              {/* Records table */}
              <div className="bg-white rounded-[28px] border border-[#f1f5f9] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#F7F9FC] border-b border-[#f1f5f9]">
                        <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase tracking-wider">Staff</th>
                        <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase tracking-wider">Date</th>
                        <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase tracking-wider">Status</th>
                        <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase tracking-wider">Check In</th>
                        <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase tracking-wider">Check Out</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f5f9]">
                      {attendanceRecords.map(rec => (
                        <tr key={rec.id} className="hover:bg-[#F7F9FC]/50 transition-colors">
                          <td className="px-5 py-4 font-semibold text-[#2D2A24]">{rec.staff_name || rec.staff_id || '—'}</td>
                          <td className="px-5 py-4 text-[#8A8680]">{fmtDate(rec.date)}</td>
                          <td className="px-5 py-4">
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${STATUS_STYLE[rec.status]?.pill || 'bg-gray-100 text-gray-600'}`}>
                              {STATUS_STYLE[rec.status]?.icon || ''} {rec.status}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-[#8A8680]">{rec.check_in || '—'}</td>
                          <td className="px-5 py-4 text-[#8A8680]">{rec.check_out || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════
          LEAVE APPLICATION MODAL
          ═══════════════════════════════════════════════════════════ */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-[#2D2A24]">Apply for Leave</h3>
              <button onClick={() => setShowLeaveModal(false)} className="p-2 text-[#8A8680] hover:text-[#2D2A24] transition-colors cursor-pointer">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Staff Member</label>
                <select value={leaveForm.staff_id} onChange={e => setLeaveForm(f => ({ ...f, staff_id: e.target.value }))}
                  className="input text-sm w-full">
                  <option value="">Select staff member</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Leave Type</label>
                <select value={leaveForm.leave_type} onChange={e => setLeaveForm(f => ({ ...f, leave_type: e.target.value }))}
                  className="input text-sm w-full">
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Casual Leave">Casual Leave</option>
                  <option value="Annual Leave">Annual Leave</option>
                  <option value="Personal Leave">Personal Leave</option>
                  <option value="Maternity Leave">Maternity Leave</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Start Date</label>
                  <input type="date" value={leaveForm.start_date} onChange={e => setLeaveForm(f => ({ ...f, start_date: e.target.value }))}
                    className="input text-sm w-full" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">End Date</label>
                  <input type="date" value={leaveForm.end_date} onChange={e => setLeaveForm(f => ({ ...f, end_date: e.target.value }))}
                    className="input text-sm w-full" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Reason</label>
                <textarea value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))}
                  className="input text-sm w-full min-h-[100px]" placeholder="Please provide a reason for leave…" />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#f1f5f9]">
              <button onClick={() => setShowLeaveModal(false)}
                className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                Cancel
              </button>
              <button onClick={() => applyLeaveMutation.mutate(leaveForm)}
                disabled={!leaveForm.staff_id || !leaveForm.start_date || !leaveForm.end_date || applyLeaveMutation.isPending}
                className="btn-primary px-6 py-2.5 text-sm font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {applyLeaveMutation.isPending ? (
                  <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Submitting…</>
                ) : 'Submit Leave'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
