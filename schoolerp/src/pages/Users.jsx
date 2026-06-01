import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteUser, getList } from '../api/frappe';
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
  'bg-emerald-50 text-emerald-700',
  'bg-rose-50 text-rose-700',
  'bg-cyan-50 text-cyan-700',
  'bg-purple-50 text-purple-700',
  'bg-blue-50 text-blue-700',
];

const roleColorCache = {};
let colorIndex = 0;

const getRoleColor = (role) => {
  if (!roleColorCache[role]) {
    roleColorCache[role] = ROLE_PALETTE[colorIndex % ROLE_PALETTE.length];
    colorIndex++;
  }
  return roleColorCache[role];
};

const fetchUsersWithRoles = async () => {
  const [instructorUsers, accountantUsers] = await Promise.all([
    getList('User', [['enabled', '=', 1], ['Has Role', 'role', '=', 'Instructor']],
      ['name', 'first_name', 'last_name', 'email', 'enabled'], 200),
    getList('User', [['enabled', '=', 1], ['Has Role', 'role', '=', 'Accountant']],
      ['name', 'first_name', 'last_name', 'email', 'enabled'], 200),
  ]);

  const userMap = new Map();
  (instructorUsers || []).forEach(u => {
    if (u.name !== 'Guest' && u.name !== 'Administrator') {
      userMap.set(u.name, { ...u, roles: ['Instructor'] });
    }
  });
  (accountantUsers || []).forEach(u => {
    if (u.name !== 'Guest' && u.name !== 'Administrator') {
      if (userMap.has(u.name)) {
        userMap.get(u.name).roles.push('Accountant');
      } else {
        userMap.set(u.name, { ...u, roles: ['Accountant'] });
      }
    }
  });

  const usersList = [...userMap.values()];
  const rolesMap = {};
  usersList.forEach(u => { rolesMap[u.name] = u.roles; });

  return { users: usersList, rolesMap };
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
    queryKey: ['User', 'team-directory'],
    queryFn: fetchUsersWithRoles,
  });

  const users = data?.users || [];
  const userRoles = data?.rolesMap || {};
  const availableRoles = ['Instructor', 'Accountant'];

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: (_, email) => {
      queryClient.invalidateQueries({ queryKey: ['User'] });
      showToast(`User ${email} deleted`);
    },
    onError: () => showToast('Failed to delete user'),
  });

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleDelete = (email) => {
    if (!window.confirm(`Delete user "${email}"? This cannot be undone.`)) return;
    deleteMutation.mutate(email);
  };

  const filtered = users.filter(u => {
    if (roleFilter && !(userRoles[u.name] || []).includes(roleFilter)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.name || '').toLowerCase().includes(q)
      || (u.first_name || '').toLowerCase().includes(q)
      || (u.last_name || '').toLowerCase().includes(q);
  });

  const totalPages = Math.ceil(filtered.length / USERS_PER_PAGE);
  const paginatedUsers = filtered.slice(
    (page - 1) * USERS_PER_PAGE,
    page * USERS_PER_PAGE
  );

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
          <p className="text-[#8A8680] mt-2 font-medium text-sm">{users.length} faculty &amp; staff members</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8680]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="input py-2.5 pl-9 pr-8 w-44 text-sm font-medium text-[#2D2A24] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] border border-[#e2e8f0] appearance-none cursor-pointer transition-[border-color,box-shadow] duration-200 focus:border-[#2ED05D] focus:shadow-[0_0_0_3px_rgba(46,208,93,0.12)]"
            >
              <option value="">All Roles</option>
              {availableRoles.map(role => (
                <option key={role} value={role}>{role}</option>
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
              placeholder="Search directory..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input py-2.5 pl-[38px] pr-4 w-56 sm:w-64 text-sm font-medium text-[#2D2A24] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] border border-[#e2e8f0] transition-[border-color,box-shadow] duration-200 placeholder:text-[#B0ABA4] focus:border-[#2ED05D] focus:shadow-[0_0_0_3px_rgba(46,208,93,0.12)]"
            />
          </div>
          <button onClick={() => queryClient.invalidateQueries({ queryKey: ['User'] })}
            className="p-2.5 bg-white border border-[#e2e8f0] shadow-[0_1px_3px_rgba(0,0,0,0.04)] rounded-xl transition-[color,background-color,transform,box-shadow] duration-200 hover:bg-[#E8F9ED] hover:border-[#BBF7D0] hover:text-[#2ED05D] cursor-pointer text-[#8A8680] active:scale-[0.95] group"
            title="Refresh">
            <svg className={`w-5 h-5 transition-transform duration-300 group-hover:rotate-180 ${loading ? 'animate-spin text-[#2ED05D]' : ''}`} style={{ animationDuration: '1s' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        <button
          onClick={() => setShowModal(true)}
          className="group bg-white rounded-[28px] border-2 border-dashed border-[#e2e8f0] p-8 flex flex-col items-center justify-center min-h-[280px] transition-[border-color,background-color,transform,box-shadow] duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)] hover:border-[#2ED05D] hover:bg-[#E8F9ED]/40 cursor-pointer active:scale-[0.97]"
        >
          <div className="w-[72px] h-[72px] rounded-[20px] bg-white border border-[#f1f5f9] shadow-[0_4px_12px_rgba(0,0,0,0.04)] flex items-center justify-center mb-5 transition-[transform,color,border-color] duration-200 group-hover:scale-110 group-hover:border-[#BBF7D0] group-hover:shadow-[0_8px_24px_rgba(46,208,93,0.12)]">
            <svg className="w-7 h-7 text-[#B0ABA4] transition-colors duration-200 group-hover:text-[#2ED05D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <span className="font-bold text-sm text-[#8A8680] transition-colors duration-200 group-hover:text-[#25B04E]">Add Team Member</span>
          <span className="text-xs text-[#B0ABA4] mt-1 transition-colors duration-200 group-hover:text-[#B0ABA4]">Invite a new member</span>
        </button>

        {paginatedUsers.map((user, i) => {
          const colors = avatarColors[i % avatarColors.length];
          return (
            <div
              key={user.name}
              className="group relative bg-white rounded-[28px] p-7 border border-[#f1f5f9]/80 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.02)] transition-[border-color,transform,box-shadow] duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)] hover:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.06),0_4px_12px_-4px_rgba(0,0,0,0.03)] hover:border-[#BBF7D0] cursor-pointer flex flex-col min-h-[280px] active:scale-[0.98]"
              onClick={() => navigate(`/users/${encodeURIComponent(user.name)}`)}
            >
              {/* Top row: avatar + status */}
              <div className="flex items-start justify-between mb-5">
                <div
                  className="w-[56px] h-[56px] rounded-[16px] flex items-center justify-center text-white font-extrabold text-xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)] ring-[3px] ring-white/60 shrink-0"
                  style={{ backgroundImage: `linear-gradient(135deg, ${colors.from}, ${colors.to})` }}
                >
                  {getInitials(user.first_name, user.last_name)}
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#f1f5f9]/50 transition-[background-color] duration-200 group-hover:bg-[#f1f5f9]">
                  <span className={`w-[6px] h-[6px] rounded-full ${user.enabled ? 'bg-emerald-500' : 'bg-red-400'}`} />
                  <span className="text-[10px] font-bold text-[#8A8680] uppercase tracking-wider">{user.enabled ? 'Active' : 'Inactive'}</span>
                </div>
              </div>

              {/* Name + email */}
              <div className="mb-4">
                <h3 className="font-extrabold text-[#2D2A24] text-[17px] leading-tight tracking-tight truncate">
                  {user.first_name || user.name} {user.last_name || ''}
                </h3>
                <p className="text-sm font-medium text-[#8A8680] truncate mt-0.5" title={user.name}>{user.name}</p>
              </div>

              {/* Role tags */}
              <div className="flex flex-wrap gap-1.5 mb-5 flex-1 content-start">
                {(userRoles[user.name] || []).slice(0, 3).map(role => (
                  <span key={role} className={`text-[11px] font-bold px-2.5 py-1 rounded-[8px] ${getRoleColor(role)}`}>
                    {role}
                  </span>
                ))}
              </div>

              {/* Bottom bar */}
              <div className="flex items-center justify-between pt-4 border-t border-[#f1f5f9]">
                <span className="text-sm font-semibold text-[#B0ABA4] transition-colors duration-200 group-hover:text-[#2ED05D] flex items-center gap-1.5">
                  View Profile
                  <svg className="w-3.5 h-3.5 transition-[opacity,transform] duration-200 -translate-x-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(user.name); }}
                  className="p-2 text-[#B0ABA4] transition-[color,background-color,transform] duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)] hover:text-red-500 hover:bg-red-50 rounded-[10px] cursor-pointer active:scale-[0.92]"
                  title="Delete User"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}

      {!loading && filtered.length === 0 && (
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
          queryClient.invalidateQueries({ queryKey: ['User'] });
          showToast('User created successfully!');
        }}
      />
    </div>
  );
}
