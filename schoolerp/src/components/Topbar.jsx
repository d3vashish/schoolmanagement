import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getPrimaryRole } from '../config/roleAccess';
import { useAcademicYear } from '../context/AcademicYearContext';
import { useNotifications } from '../context/NotificationContext';

function useDropdownPosition(buttonRef, open) {
  const [pos, setPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    });
  }, [open, buttonRef]);

  return pos;
}

function timeAgo(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const roleLabel = getPrimaryRole(user?.roles || []);
  const { selectedYear, setSelectedYear, academicYears, isCurrentYear, currentYear, isTeacher } = useAcademicYear();
  const { notifications, unreadCount, loading, fetchNotifications, markAsRead, markAllAsRead } = useNotifications();
  const [search, setSearch] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const profileBtnRef = useRef(null);
  const yearBtnRef = useRef(null);
  const notifBtnRef = useRef(null);

  const profilePos = useDropdownPosition(profileBtnRef, showProfile);
  const yearPos = useDropdownPosition(yearBtnRef, showYearDropdown);
  const notifPos = useDropdownPosition(notifBtnRef, showNotifications);

  const selectedYearName = academicYears.find(y => y.id === selectedYear)?.name || selectedYear || 'Select Year';

  const handleLogout = async () => {
    setShowProfile(false);
    await logout();
    navigate('/login');
  };

  const handleProfile = () => {
    setShowProfile(false);
    navigate(`/users/${encodeURIComponent(user?.email || '')}`);
  };

  const handleSettings = () => {
    setShowProfile(false);
    navigate('/settings');
  };

  const handleToggleNotifications = () => {
    const next = !showNotifications;
    setShowNotifications(next);
    if (next) fetchNotifications();
  };

  const handleNotificationClick = (n) => {
    if (!n.is_read) markAsRead(n.id);
    setShowNotifications(false);
    if (n.link) navigate(n.link);
  };

  return (
    <header className="flex items-center justify-between px-6 animate-in-down"
      style={{ height: '64px', background: '#F7F9FC', position: 'relative', zIndex: 10 }}>
      <div className="flex items-center gap-2 flex-1 max-w-sm">
        <div className="relative w-full">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-[16px] text-sm text-[#1F2A44] outline-none transition-all duration-200 placeholder:text-[#94A3B8]"
            style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              fontFamily: "'Inter', 'Poppins', 'Plus Jakarta Sans', sans-serif",
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Academic Year */}
        <div className="relative">
          {isTeacher ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[999px] bg-[#E8F9ED] text-xs">
              <svg className="w-3.5 h-3.5 text-[#2ED05D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="font-bold text-[#2ED05D]">{selectedYearName}</span>
            </div>
          ) : (
            <button ref={yearBtnRef} onClick={() => setShowYearDropdown(o => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[999px] bg-[#E8F9ED] text-xs transition-all cursor-pointer hover:bg-[#D1FAE5] active:scale-[0.96]">
              <svg className="w-3.5 h-3.5 text-[#2ED05D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="font-bold text-[#2ED05D]">{selectedYearName}</span>
              {!isCurrentYear && selectedYear && (() => {
                const sel = academicYears.find(y => y.id === selectedYear);
                const cur = academicYears.find(y => y.id === currentYear);
                const isPast = sel && cur && new Date(sel.start_date) < new Date(cur.start_date);
                return (
                  <span className="px-1 py-0.5 bg-[#D1FAE5] text-[#047857] rounded text-[9px] font-bold">
                    {isPast ? 'PREV' : 'NEXT'}
                  </span>
                );
              })()}
              <svg className={`w-3 h-3 text-[#2ED05D] transition-transform ${showYearDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>

        {/* Notifications */}
        <button
          ref={notifBtnRef}
          onClick={handleToggleNotifications}
          className="relative w-9 h-9 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center hover:bg-[#E8F9ED] hover:border-[#2ED05D]/30 transition-all duration-200 cursor-pointer active:scale-[0.96] group"
        >
          <svg className="w-4 h-4 text-[#64748B] group-hover:text-[#2ED05D] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 bg-[#2ED05D] border-2 border-[#F7F9FC] rounded-full text-[7px] font-bold text-white flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Profile */}
        <div className="relative">
          <button ref={profileBtnRef} onClick={() => setShowProfile(o => !o)}
            className="flex items-center gap-2 px-2 py-1 rounded-[999px] hover:bg-[#E8F9ED] transition-all duration-200 cursor-pointer active:scale-[0.97] group">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2ED05D] to-[#22C55E] flex items-center justify-center text-xs font-bold text-white">
              {(user?.full_name || user?.usr || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-semibold text-[#1F2A44] leading-tight">{user?.full_name || user?.email || 'User'}</p>
              <p className="text-[9px] text-[#94A3B8]">{roleLabel}</p>
            </div>
          </button>
        </div>
      </div>

      {/* Year dropdown — portalled to body */}
      {showYearDropdown && !isTeacher && createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setShowYearDropdown(false)} />
          <div style={{ position: 'fixed', top: yearPos.top, right: yearPos.right, zIndex: 9999 }}
            className="w-48 bg-white rounded-2xl shadow-xl p-1.5 border border-[#E2E8F0]">
            {academicYears.map(y => (
              <button key={y.id}
                onClick={() => { setSelectedYear(y.id); setShowYearDropdown(false); }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer text-[#475569] hover:bg-[#E8F9ED]">
                <span>{y.name}</span>
                {y.is_current && (
                  <span className="px-1.5 py-0.5 bg-[#E8F9ED] text-[#2ED05D] rounded text-[9px] font-bold">Now</span>
                )}
              </button>
            ))}
            {academicYears.length === 0 && (
              <p className="px-3 py-2.5 text-xs text-[#94A3B8]">No academic years found</p>
            )}
          </div>
        </>,
        document.body
      )}

      {/* Notifications dropdown — portalled to body */}
      {showNotifications && createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setShowNotifications(false)} />
          <div style={{ position: 'fixed', top: notifPos.top, right: notifPos.right, zIndex: 9999 }}
            className="w-80 bg-white rounded-2xl shadow-xl border border-[#E2E8F0] p-2 max-h-[420px] overflow-y-auto">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#E2E8F0] mb-1">
              <p className="text-sm font-semibold text-[#1F2A44]">Notifications</p>
              {notifications.some(n => !n.is_read) && (
                <button
                  onClick={markAllAsRead}
                  className="text-[11px] font-semibold text-[#2ED05D] hover:underline cursor-pointer"
                >
                  Mark all read
                </button>
              )}
            </div>

            {loading && (
              <p className="px-3 py-4 text-xs text-[#94A3B8] text-center">Loading...</p>
            )}

            {!loading && notifications.length === 0 && (
              <p className="px-3 py-4 text-xs text-[#94A3B8] text-center">No notifications yet</p>
            )}

            {!loading && notifications.map(n => (
              <button
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer hover:bg-[#E8F9ED] ${
                  n.is_read ? '' : 'bg-[#F0FDF4]'
                }`}
              >
                {!n.is_read && (
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#2ED05D] flex-shrink-0" />
                )}
                <div className={n.is_read ? 'pl-3.5' : ''}>
                  <p className="text-sm font-medium text-[#1F2A44] leading-tight">{n.title}</p>
                  <p className="text-xs text-[#64748B] mt-0.5 leading-snug">{n.message}</p>
                  <p className="text-[10px] text-[#94A3B8] mt-1">{timeAgo(n.created_at)}</p>
                </div>
              </button>
            ))}
          </div>
        </>,
        document.body
      )}

      {/* Profile dropdown — portalled to body */}
      {showProfile && createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setShowProfile(false)} />
          <div style={{ position: 'fixed', top: profilePos.top, right: profilePos.right, zIndex: 9999 }}
            className="w-56 bg-white rounded-2xl shadow-xl border border-[#E2E8F0] p-2">
            <div className="px-3 py-2.5 border-b border-[#E2E8F0] mb-1">
              <p className="text-sm font-semibold text-[#1F2A44]">{user?.full_name || user?.email}</p>
              <p className="text-xs text-[#94A3B8]">{user?.email}</p>
            </div>
            <button onClick={handleProfile}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-[#475569] hover:bg-[#E8F9ED] transition-all cursor-pointer group">
              <svg className="w-4 h-4 text-[#64748B] group-hover:text-[#2ED05D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Profile
            </button>
            <button onClick={handleSettings}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-[#475569] hover:bg-[#E8F9ED] transition-all cursor-pointer group">
              <svg className="w-4 h-4 text-[#64748B] group-hover:text-[#2ED05D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </button>
            <div className="mt-1 pt-1 border-t border-[#E2E8F0]">
              <button onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-[#EF4444] hover:bg-[#FEF2F2] transition-all cursor-pointer">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </header>
  );
}