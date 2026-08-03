import { adminGetDashboard, backupNow } from '../api/frappe';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

const CARD_GRADIENTS = [
  'linear-gradient(135deg, #8EDFD2, #7ED7C9)',
  'linear-gradient(135deg, #F5D98B, #F0CF74)',
  'linear-gradient(135deg, #C9A4F5, #B48DEB)',
  'linear-gradient(135deg, #F58E92, #EF767B)',
];

const ROLE_LABELS = {
  super_admin: 'Super Admins',
  principal: 'Principals',
  teacher: 'Teachers',
  accountant: 'Accountants',
  librarian: 'Librarians',
  parent: 'Parents',
  student: 'Students',
};

const ROLE_GRADIENTS = {
  super_admin: 'from-red-500/10 to-red-500/5',
  principal: 'from-purple-500/10 to-purple-500/5',
  teacher: 'from-blue-500/10 to-blue-500/5',
  accountant: 'from-amber-500/10 to-amber-500/5',
  librarian: 'from-cyan-500/10 to-cyan-500/5',
  parent: 'from-green-500/10 to-green-500/5',
  student: 'from-emerald-500/10 to-emerald-500/5',
};

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: adminGetDashboard,
  });

  const [backing, setBacking] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');
  const handleBackup = async () => {
    setBacking(true); setBackupMsg('');
    try {
      const res = await backupNow();
      const parts = [];
      if (res.excel_file) parts.push('Excel');
      if (res.sql_file) parts.push('SQL');
      const made = parts.length ? parts.join(' + ') : 'files';
      let msg = `✓ Backup complete — ${made} for ${res.tables} tables saved to local app data. ${res.cloud || ''}`;
      if (res.excel_error) msg += `  (Excel note: ${res.excel_error})`;
      setBackupMsg(msg);
    } catch (e) {
      setBackupMsg(`✗ ${e?.response?.data?.detail || 'Backup failed'}`);
    } finally { setBacking(false); }
  };

  const kpis = [
    { label: 'Total Users', value: data?.total_users ?? '—', gradient: CARD_GRADIENTS[0] },
    { label: 'Active Today', value: data?.active_today ?? '—', gradient: CARD_GRADIENTS[1] },
    { label: 'Roles', value: Object.keys(data?.users_by_role || {}).length, gradient: CARD_GRADIENTS[2] },
    { label: 'Storage', value: data?.storage_used_mb ? `${data.storage_used_mb.toFixed(1)} MB` : '0 MB', gradient: CARD_GRADIENTS[3] },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="eyebrow">Administration</div>
          <h1 className="text-[2rem] sm:text-[2.5rem] font-extrabold text-[#2D2A24] tracking-tight leading-[1.1] -mt-1">Admin Dashboard</h1>
          <p className="text-[#8A8680] mt-2 font-medium text-sm">System overview for super admins</p>
        </div>
        <button onClick={handleBackup} disabled={backing}
          className={`px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-colors ${backing ? 'bg-gray-400 cursor-wait' : 'bg-[#2ED05D] hover:bg-[#25B04E]'}`}>
          {backing ? 'Backing up…' : '⬇ Backup Now'}
        </button>
      </div>
      {backupMsg && (
        <div className={`px-4 py-3 rounded-xl text-sm font-semibold ${backupMsg.startsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{backupMsg}</div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-[140px] rounded-[28px] shimmer" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {kpis.map((kpi, i) => (
              <div key={kpi.label} className="relative overflow-hidden rounded-[28px] animate-in"
                style={{ animationDelay: `${i * 80}ms`, background: kpi.gradient }}>
                <div className="blob w-20 h-20 bg-white/10 -top-6 -right-6" />
                <div className="blob w-12 h-12 bg-white/8 -bottom-3 -left-3" />
                <div className="relative z-10 p-6">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/80 mb-2">{kpi.label}</p>
                  <p className="text-3xl font-bold text-white">{kpi.value}</p>
                </div>
              </div>
            ))}
          </div>

          {data?.users_by_role && Object.keys(data.users_by_role).length > 0 && (
            <div className="bg-white rounded-[28px] p-6 border border-[#f1f5f9]/80 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
              <h3 className="text-base font-bold text-[#2D2A24] mb-4">Users by Role</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(data.users_by_role).map(([role, count]) => (
                  <div key={role}
                    className={`rounded-2xl p-4 bg-gradient-to-br ${ROLE_GRADIENTS[role] || 'from-gray-50 to-gray-50'} border border-[#f1f5f9]`}>
                    <p className="text-2xl font-bold text-[#2D2A24]">{count}</p>
                    <p className="text-xs font-medium text-[#8A8680] mt-1">{ROLE_LABELS[role] || role}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}