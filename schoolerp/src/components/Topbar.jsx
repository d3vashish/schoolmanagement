import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { getPrimaryRole } from '../config/roleAccess';
import { useAcademicYear } from '../context/AcademicYearContext';
import { client } from '../api/frappe';

export default function Topbar() {
  const { user } = useAuth();
  const roleLabel = getPrimaryRole(user?.roles || []);
  const { selectedYear, setSelectedYear, academicYears, currentYear, isCurrentYear, isTeacher } = useAcademicYear();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showCreateYear, setShowCreateYear] = useState(false);
  const [yn, setYn] = useState({ name: '', start_date: '', end_date: '' });
  const [savingYear, setSavingYear] = useState(false);
  const [yearErr, setYearErr] = useState('');

  const createYear = async (e) => {
    e.preventDefault();
    setSavingYear(true); setYearErr('');
    try {
      await client.post('/academic/years', {
        name: yn.name.trim(),
        start_date: yn.start_date,
        end_date: yn.end_date,
        is_active: academicYears.length === 0,
      });
      await queryClient.invalidateQueries({ queryKey: ['Academic Year'] });
      setSelectedYear(yn.name.trim());
      setShowCreateYear(false); setShowYearDropdown(false);
      setYn({ name: '', start_date: '', end_date: '' });
    } catch (err) {
      setYearErr(err?.response?.data?.detail || 'Could not create academic year');
    } finally {
      setSavingYear(false);
    }
  };

  return (
    <header className="flex items-center justify-between px-6 animate-in-down"
      style={{ height: '64px', background: '#F7F9FC' }}>
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
              <span className="font-bold text-[#2ED05D]">{selectedYear || '—'}</span>
            </div>
          ) : (
            <button onClick={() => setShowYearDropdown(o => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[999px] bg-[#E8F9ED] text-xs transition-all cursor-pointer hover:bg-[#D1FAE5] active:scale-[0.96]">
              <svg className="w-3.5 h-3.5 text-[#2ED05D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="font-bold text-[#2ED05D]">{selectedYear || 'Select Year'}</span>
              {!isCurrentYear && (
                <span className="px-1 py-0.5 bg-[#D1FAE5] text-[#047857] rounded text-[9px] font-bold">PREV</span>
              )}
              <svg className={`w-3 h-3 text-[#2ED05D] transition-transform ${showYearDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}

          {showYearDropdown && !isTeacher && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowYearDropdown(false)} />
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-lg z-50 p-1.5 border border-[#E2E8F0]">
                {academicYears.map(y => (
                  <button key={y.name}
                    onClick={() => { setSelectedYear(y.name); setShowYearDropdown(false); }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer text-[#475569] hover:bg-[#E8F9ED]">
                    <span>{y.name}</span>
                    {y.name === currentYear && (
                      <span className="px-1.5 py-0.5 bg-[#E8F9ED] text-[#2ED05D] rounded text-[9px] font-bold">Now</span>
                    )}
                  </button>
                ))}
                {academicYears.length === 0 && (
                  <p className="px-3 py-2.5 text-xs text-[#94A3B8]">No academic years found</p>
                )}
                <button
                  onClick={() => { setShowYearDropdown(false); setShowCreateYear(true); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 mt-1 rounded-xl text-sm font-semibold text-[#2ED05D] hover:bg-[#E8F9ED] transition-all cursor-pointer border-t border-[#E2E8F0]">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New academic year
                </button>
              </div>
            </>
          )}

          {showCreateYear && (
            <>
              <div className="fixed inset-0 z-[60] bg-black/30" onClick={() => setShowCreateYear(false)} />
              <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[61] w-[340px] bg-white rounded-2xl shadow-xl border border-[#E2E8F0] p-5">
                <h3 className="text-base font-bold text-[#1F2A44] mb-1">New academic year</h3>
                <p className="text-xs text-[#94A3B8] mb-4">Create a year before adding classes, students, or fees.</p>
                <form onSubmit={createYear} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-[#475569] mb-1">Name <span className="text-red-500">*</span></label>
                    <input type="text" required autoFocus value={yn.name}
                      onChange={e => setYn(v => ({ ...v, name: e.target.value }))}
                      placeholder="e.g. 2026-2027"
                      className="w-full px-3 py-2 rounded-xl text-sm border border-[#E2E8F0] outline-none focus:border-[#2ED05D]" />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-[#475569] mb-1">Start <span className="text-red-500">*</span></label>
                      <input type="date" required value={yn.start_date}
                        onChange={e => setYn(v => ({ ...v, start_date: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl text-sm border border-[#E2E8F0] outline-none focus:border-[#2ED05D]" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-[#475569] mb-1">End <span className="text-red-500">*</span></label>
                      <input type="date" required value={yn.end_date}
                        onChange={e => setYn(v => ({ ...v, end_date: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl text-sm border border-[#E2E8F0] outline-none focus:border-[#2ED05D]" />
                    </div>
                  </div>
                  {yearErr && <p className="text-xs text-red-500">{String(yearErr)}</p>}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button type="button" onClick={() => setShowCreateYear(false)}
                      className="px-3 py-2 rounded-xl text-sm text-[#475569] hover:bg-[#F1F5F9] cursor-pointer">Cancel</button>
                    <button type="submit" disabled={savingYear}
                      className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#2ED05D] hover:bg-[#22C55E] disabled:opacity-50 cursor-pointer flex items-center gap-2">
                      {savingYear && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                      Create
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}
        </div>

        {/* Notifications */}
        <button className="relative w-9 h-9 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center hover:bg-[#E8F9ED] hover:border-[#2ED05D]/30 transition-all duration-200 cursor-pointer active:scale-[0.96] group">
          <svg className="w-4 h-4 text-[#64748B] group-hover:text-[#2ED05D] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-[#2ED05D] border-2 border-[#F7F9FC] rounded-full text-[7px] font-bold text-white flex items-center justify-center">3</span>
        </button>

        {/* Profile */}
        <div className="relative">
          <button onClick={() => setShowProfile(o => !o)}
            className="flex items-center gap-2 px-2 py-1 rounded-[999px] hover:bg-[#E8F9ED] transition-all duration-200 cursor-pointer active:scale-[0.97] group">
            <div className="w-8 h-8 rounded-full bg-linear-to-br from-[#2ED05D] to-[#22C55E] flex items-center justify-center text-xs font-bold text-white">
              {(user?.full_name || user?.usr || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-semibold text-[#1F2A44] leading-tight">{user?.full_name || user?.usr || 'User'}</p>
              <p className="text-[9px] text-[#94A3B8]">{roleLabel}</p>
            </div>
          </button>

          {showProfile && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowProfile(false)} />
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-lg border border-[#E2E8F0] z-50 p-2">
                <div className="px-3 py-2.5 border-b border-[#E2E8F0] mb-1">
                  <p className="text-sm font-semibold text-[#1F2A44]">{user?.full_name || user?.usr}</p>
                  <p className="text-xs text-[#94A3B8]">{user?.usr}</p>
                </div>
                <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-[#475569] hover:bg-[#E8F9ED] transition-all cursor-pointer group">
                  <svg className="w-4 h-4 text-[#64748B] group-hover:text-[#2ED05D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Profile
                </button>
                <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-[#475569] hover:bg-[#E8F9ED] transition-all cursor-pointer group">
                  <svg className="w-4 h-4 text-[#64748B] group-hover:text-[#2ED05D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Settings
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
