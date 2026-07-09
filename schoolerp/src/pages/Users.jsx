import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminListUsers, adminToggleUserStatus } from '../api/frappe';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import UserModal from '../components/UserModal';
import Pagination from '../components/Pagination';

const getInitials = (first, last) => {
  const a = (first || '')[0] || '';
  const b = (last || '')[0] || '';
  return (a + b).toUpperCase() || '?';
};

const avatarColors = [
  { from: '#2ED05D', to: '#E07028' },
  { from: '#6C8EBF', to: '#4A6FA5' },
  { from: '#B877D9', to: '#9A5FC4' },
  { from: '#F06A6A', to: '#D94A4A' },
  { from: '#5CB8A0', to: '#3D9E86' },
  { from: '#E8A060', to: '#D08848' },
  { from: '#A08CD6', to: '#826DC4' },
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

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  principal: 'Principal',
  teacher: 'Teacher',
  accountant: 'Accountant',
  librarian: 'Librarian',
  parent: 'Parent',
  student: 'Student',
};

const roleColorCache = {};
let colorIndex = 0;

const getRoleColor = (role) => {
  if (!roleColorCache[role]) {
    roleColorCache[role] = ROLE_PALETTE[colorIndex % ROLE_PALETTE.length];
    colorIndex++;
  }
  return roleColorCache[role];
};

export default function Users() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState('');
  const [page, setPage] = useState(1);
  const USERS_PER_PAGE = 12;

  const { data, isLoading: loading } = useQuery({
    queryKey: ['admin', 'users', { role: roleFilter, search, page, page_size: USERS_PER_PAGE }],
    queryFn: () => adminListUsers({
      page,
      page_size: USERS_PER_PAGE,
      role: roleFilter || undefined,
      search: search || undefined,
    }),
  });

  const users = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / USERS_PER_PAGE);
  const availableRoles = ['teacher', 'accountant', 'principal', 'librarian'];

  const toggleMutation = useMutation({
    mutationFn: adminToggleUserStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      showToast('User status updated');
    },
    onError: () => showToast('Failed to update user'),
  });

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleToggleStatus = (user) => {
    const action = user.is_active ? 'disable' : 'enable';
    if (!window.confirm(`${action === 'disable' ? 'Disable' : 'Enable'} user "${user.email}"?`)) return;
    toggleMutation.mutate(user.id);
  };

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-16">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl text-sm font-semibold bg-[#2D2A24] text-white shadow-[0_8px_32px_rgba(0,0,0,0.2)] animate-fade-in-up">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <div className="eyebrow">People</div>
          <h1 className="text-[2rem] sm:text-[2.5rem] font-extrabold text-[#2D2A24] tracking-tight leading-[1.1] -mt-1">Team Directory</h1>
          <p className="text-[#8A8680] mt-2 font-medium text-sm">{total} faculty &amp; staff members</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8680]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <select
              value={roleFilter}
              onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
              className="input py-2.5 pl-9 pr-8 w-44 text-sm font-medium text-[#2D2A24] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] border border-[#e2e8f0] appearance-none cursor-pointer transition-[border-color,box-shadow] duration-200 focus:border-[#2ED05D] focus:shadow-[0_0_0_3px_rgba(46,208,93,0.12)]"
            >
              <option value="">All Roles</option>
              {availableRoles.map(role => (
                <option key={role} value={role}>{ROLE_LABELS[role] || role}</option>
              ))}
            </select>
            <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8A8680]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8680]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by email..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="input py-2.5 pl-[38px] pr-4 w-56 sm:w-64 text-sm font-medium text-[#2D2A24] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] border border-[#e2e8f0] transition-[border-color,box-shadow] duration-200 placeholder:text-[#B0ABA4] focus:border-[#2ED05D] focus:shadow-[0_0_0_3px_rgba(46,208,93,0.12)]"
            />
          </div>
          <button onClick={() => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })}
            className="p-2.5 bg-white border border-[#e2e8f0] shadow-[0_1px_3px_rgba(0,0,0,0.04)] rounded-xl transition-[color,background-color,transform,box-shadow] duration-200 hover:bg-[#E8F9ED] hover:border-[#BBF7D0] hover:text-[#2ED05D] cursor-pointer text-[#8A8680] active:scale-[0.95] group"
            title="Refresh">
            <svg className={`w-5 h-5 transition-transform duration-300 group-hover:rotate-180 ${loading ? 'animate-spin text-[#2ED05D]' : ''}`} style={{ animationDuration: '1s' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Add member bar */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2ED05D] text-white font-bold text-sm shadow-sm hover:bg-[#25B04E] transition-colors active:scale-[0.97]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Team Member
        </button>
      </div>

      {/* List / Table */}
      <div className="bg-white rounded-2xl border border-[#f1f5f9] shadow-[0_2px_8px_rgba(0,0,0,0.02)] overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="bg-[#f8fafc] text-left text-[#8A8680] text-xs uppercase tracking-wider">
              <th className="px-5 py-3 font-semibold">Name</th>
              <th className="px-5 py-3 font-semibold">Email</th>
              <th className="px-5 py-3 font-semibold">Role</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, i) => {
              const colors = avatarColors[i % avatarColors.length];
              return (
                <tr
                  key={user.id}
                  className="border-t border-[#f1f5f9] hover:bg-[#f8fafc] cursor-pointer transition-colors"
                  onClick={() => navigate(`/admin/users/${user.id}`)}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-[12px] flex items-center justify-center text-white font-extrabold text-sm shrink-0"
                        style={{ backgroundImage: `linear-gradient(135deg, ${colors.from}, ${colors.to})` }}
                      >
                        {getInitials(user.first_name, user.last_name)}
                      </div>
                      <span className="font-bold text-[#2D2A24] truncate">
                        {user.first_name || user.email} {user.last_name || ''}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[#8A8680] font-medium truncate" title={user.email}>{user.email}</td>
                  <td className="px-5 py-3">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-[8px] ${getRoleColor(user.role)}`}>
                      {ROLE_LABELS[user.role] || user.role}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`w-[6px] h-[6px] rounded-full ${user.is_active ? 'bg-emerald-500' : 'bg-red-400'}`} />
                      <span className="text-[11px] font-bold text-[#8A8680] uppercase tracking-wider">{user.is_active ? 'Active' : 'Inactive'}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <span className="text-[#2ED05D] font-semibold hidden sm:inline">View</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleStatus(user); }}
                        className={`p-2 rounded-[10px] transition-colors ${user.is_active ? 'text-[#B0ABA4] hover:text-red-500 hover:bg-red-50' : 'text-[#2ED05D] hover:text-emerald-600 hover:bg-emerald-50'}`}
                        title={user.is_active ? 'Disable User' : 'Enable User'}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {user.is_active ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          )}
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}

      {!loading && users.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-[28px] border border-[#f1f5f9] shadow-[0_2px_8px_rgba(0,0,0,0.02)] mt-2">
          <div className="w-[72px] h-[72px] rounded-[20px] bg-[#E8F9ED] flex items-center justify-center mb-5">
            <svg className="w-8 h-8 text-[#2ED05D]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-[#2D2A24] mb-1">No users found</h3>
          <p className="text-sm font-medium text-[#8A8680]">
            {search ? 'Try adjusting your search or filters.' : 'Your directory is currently empty.'}
          </p>
        </div>
      )}

      <UserModal
        show={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => {
          setShowModal(false);
          queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
          showToast('User created successfully!');
        }}
      />
    </div>
  );
}