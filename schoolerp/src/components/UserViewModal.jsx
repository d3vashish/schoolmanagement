export default function UserViewModal({ user, roles, onClose }) {
  if (!user) return null;

  const getInitials = (first, last) => {
    const a = (first || '')[0] || '';
    const b = (last || '')[0] || '';
    return (a + b).toUpperCase() || '?';
  };

  const avatarColors = ['#2ED05D', '#2563EB', '#7C3AED', '#DC2626', '#059669', '#D946EF', '#0891B2', '#CA8A04'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-2xl shadow-xl p-5 sm:p-6 w-full max-w-md mx-3 sm:mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm sm:text-base flex-shrink-0"
              style={{ background: avatarColors[user.name.length % avatarColors.length] }}
            >
              {getInitials(user.first_name, user.last_name)}
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-[#1e293b] truncate">
                {user.first_name || user.name}{user.last_name ? ` ${user.last_name}` : ''}
              </h2>
              <p className="text-xs sm:text-sm text-[#475569] truncate">{user.email || user.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className={`w-2 h-2 rounded-full ${user.enabled ? 'bg-green-500' : 'bg-red-400'}`} title={user.enabled ? 'Enabled' : 'Disabled'} />
            <button onClick={onClose} className="p-1.5 sm:p-2 text-[#475569] hover:text-[#1e293b] transition-colors cursor-pointer group">
              <span className="w-6 h-6 rounded-full bg-black/5 flex items-center justify-center transition-all duration-300 group-hover:bg-black/10">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
            </button>
          </div>
        </div>

        <div className="space-y-3 sm:space-y-4">
          <div>
            <label className="text-[10px] sm:text-xs font-medium text-[#475569] uppercase tracking-wide">Email</label>
            <p className="text-xs sm:text-sm text-[#1e293b] mt-0.5 break-all">{user.email || user.name}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="text-[10px] sm:text-xs font-medium text-[#475569] uppercase tracking-wide">First Name</label>
              <p className="text-xs sm:text-sm text-[#1e293b] mt-0.5">{user.first_name || '—'}</p>
            </div>
            <div>
              <label className="text-[10px] sm:text-xs font-medium text-[#475569] uppercase tracking-wide">Last Name</label>
              <p className="text-xs sm:text-sm text-[#1e293b] mt-0.5">{user.last_name || '—'}</p>
            </div>
          </div>

          <div>
            <label className="text-[10px] sm:text-xs font-medium text-[#475569] uppercase tracking-wide">Mobile Number</label>
            <p className="text-xs sm:text-sm text-[#1e293b] mt-0.5">{user.mobile_no || '—'}</p>
          </div>

          <div>
            <label className="text-[10px] sm:text-xs font-medium text-[#475569] uppercase tracking-wide">Status</label>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${user.enabled ? 'bg-green-500' : 'bg-red-400'}`} />
              <span className="text-xs sm:text-sm text-[#1e293b]">{user.enabled ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>

          <div>
            <label className="text-[10px] sm:text-xs font-medium text-[#475569] uppercase tracking-wide mb-1.5 sm:mb-2 block">Roles</label>
            <div className="flex flex-wrap gap-1.5">
              {(roles || []).length > 0 ? (
                roles.map(role => {
                  const palette = ['bg-[#BBF7D0] text-[#2ED05D]', 'bg-[#BBF7D0] text-[#2ED05D]', 'bg-emerald-100 text-emerald-700', 'bg-emerald-100 text-emerald-700', 'bg-rose-100 text-rose-700', 'bg-cyan-100 text-cyan-700'];
                  return (
                    <span key={role} className={`text-[10px] sm:text-xs font-medium px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full ${palette[role.length % palette.length]}`}>
                      {role}
                    </span>
                  );
                })
              ) : (
                <span className="text-xs sm:text-sm text-[#475569]">No roles assigned</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 sm:pt-5 mt-4 sm:mt-5 border-t border-gray-100">
          <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-[#475569] hover:text-[#1e293b] transition-colors cursor-pointer">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
