import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminGetUser, adminToggleUserStatus, adminResetPassword } from '../api/frappe';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  principal: 'Principal',
  teacher: 'Teacher',
  accountant: 'Accountant',
  librarian: 'Librarian',
  parent: 'Parent',
  student: 'Student',
};

export default function AdminUserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [pwError, setPwError] = useState('');

  const { data: user, isLoading } = useQuery({
    queryKey: ['admin', 'users', id],
    queryFn: () => adminGetUser(id),
    enabled: !!id,
  });

  const toggleMutation = useMutation({
    mutationFn: () => adminToggleUserStatus(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const resetPwMutation = useMutation({
    mutationFn: () => adminResetPassword(id, newPassword),
    onSuccess: () => {
      setResetPwOpen(false);
      setNewPassword('');
      setPwError('');
    },
    onError: (err) => setPwError(err.response?.data?.detail || 'Failed to reset password'),
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 py-8">
        <div className="h-8 w-48 rounded-lg shimmer" />
        <div className="h-64 rounded-[28px] shimmer" />
      </div>
    );
  }

  if (!user) {
    return <div className="max-w-4xl mx-auto py-8 text-center text-[#8A8680]">User not found</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      <button onClick={() => navigate('/users')} className="flex items-center gap-2 text-sm font-semibold text-[#8A8680] hover:text-[#2D2A24] transition-colors cursor-pointer">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Directory
      </button>

      <div className="bg-white rounded-[28px] p-8 border border-[#f1f5f9]/80 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-5">
            <div className="w-[72px] h-[72px] rounded-[20px] bg-gradient-to-br from-[#2ED05D] to-[#E07028] flex items-center justify-center text-white font-extrabold text-2xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)] ring-[3px] ring-white/60">
              {((user.first_name || '')[0] || (user.email || '')[0] || '?').toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-[#2D2A24]">
                {user.first_name || ''} {user.last_name || ''}
              </h1>
              <p className="text-sm font-medium text-[#8A8680] mt-1">{user.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-[8px] ${user.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-[8px] bg-blue-50 text-blue-700">
                  {ROLE_LABELS[user.role] || user.role}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => toggleMutation.mutate()}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${user.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
              {user.is_active ? 'Disable' : 'Enable'}
            </button>
            <button onClick={() => setResetPwOpen(true)}
              className="px-4 py-2 rounded-xl text-sm font-bold bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0] transition-all cursor-pointer">
              Reset Password
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#8A8680] uppercase tracking-wider">Details</h3>
            <div className="space-y-3">
              <DetailRow label="User ID" value={user.id} />
              <DetailRow label="Email" value={user.email} />
              <DetailRow label="Phone" value={user.phone || '—'} />
              <DetailRow label="Role" value={ROLE_LABELS[user.role] || user.role} />
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#8A8680] uppercase tracking-wider">Timeline</h3>
            <div className="space-y-3">
              <DetailRow label="Created" value={user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'} />
              <DetailRow label="Status" value={user.is_active ? 'Active' : 'Inactive'} />
            </div>
          </div>
        </div>
      </div>

      {resetPwOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setResetPwOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[#2D2A24] mb-4">Reset Password</h2>
            {pwError && <div className="mb-4 p-3 rounded-xl text-sm bg-red-50 text-red-600">{pwError}</div>}
            <input
              type="password"
              value={newPassword}
              onChange={e => { setNewPassword(e.target.value); setPwError(''); }}
              placeholder="New password"
              className="input w-full mb-4"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setResetPwOpen(false)} className="px-4 py-2 rounded-xl text-sm font-bold text-[#8A8680] hover:bg-[#F1F5F9] cursor-pointer">Cancel</button>
              <button onClick={() => resetPwMutation.mutate()} disabled={!newPassword || resetPwMutation.isPending}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-[#2D2A24] text-white hover:bg-[#1a1a1a] disabled:opacity-50 cursor-pointer">
                {resetPwMutation.isPending ? 'Resetting...' : 'Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#f1f5f9] last:border-0">
      <span className="text-sm font-medium text-[#8A8680]">{label}</span>
      <span className="text-sm font-semibold text-[#2D2A24] truncate ml-4">{value || '—'}</span>
    </div>
  );
}
