import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { getAllowedPages } from '../config/roleAccess';
import { useState } from 'react';

const icons = {
  dashboard:    'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  settings:     'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  classes:      'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
  subjects:     'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  students:     'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  employees:    'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  accounts:     'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  fees:         'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
  salary:       'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  attendance:   'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  timetable:    'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  homework:     'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z',
  behaviour:    'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  messaging:    'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
  sms:          'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  liveclass:    'M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
  exams:        'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  classtests:   'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  reports:      'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  certificates: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
  users:        'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  logout:       'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
  store:        'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',
  library:      'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
};

const navGroups = [
  { label: 'Main', iconColor: '#FDBA74', items: [
    { path: '/',           label: 'Dashboard',         icon: 'dashboard' },
    { path: '/parent',     label: 'Parent Portal',     icon: 'users'     },
    { path: '/settings',   label: 'Settings',          icon: 'settings'  },
  ]},
  { label: 'Academic', iconColor: '#FB923C', items: [
    { path: '/students',   label: 'Students',          icon: 'students'   },
    { path: '/classes',    label: 'Classes',           icon: 'classes'    },
    { path: '/subjects',   label: 'Subjects',          icon: 'subjects'   },
    { path: '/attendance', label: 'Attendance',        icon: 'attendance' },
    { path: '/timetable',  label: 'Timetable',         icon: 'timetable'  },
    { path: '/homework',   label: 'Homework',          icon: 'homework'   },
    { path: '/library',       label: 'Library',           icon: 'library'    },
    { path: '/admissions',    label: 'Admissions',        icon: 'students'   },
  ]},
  { label: 'Examinations', iconColor: '#F97316', items: [
    { path: '/class-tests',  label: 'Class Tests',  icon: 'classtests'   },
    { path: '/exam-management', label: 'Exam Management', icon: 'exams'       },
  ]},
  { label: 'HR & Finance', iconColor: '#F59E0B', items: [
    { path: '/employees', label: 'Employees', icon: 'employees' },
    { path: '/salary',    label: 'Salary',    icon: 'salary'    },
    { path: '/accounts',  label: 'Accounts',  icon: 'accounts'  },
    { path: '/fees',      label: 'Fees',      icon: 'fees'      },
  ]},
  { label: 'Admin', iconColor: '#FBBF24', items: [
    { path: '/admin',    label: 'Dashboard',  icon: 'dashboard' },
    { path: '/users',    label: 'Users',      icon: 'users' },
    { path: '/audit-log', label: 'Audit Log', icon: 'reports' },
  ]},
];

function Icon({ d, className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d} />
    </svg>
  );
}

function GroupSection({ group, defaultOpen = true, styleDelay }) {
  const location = useLocation();
  const [open, setOpen] = useState(defaultOpen);
  const active = group.items.some(i => location.pathname === i.path || location.pathname.startsWith(i.path + '/'));

  return (
    <div className="animate-in" style={{ animationDelay: `${styleDelay}ms` }}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-1.5 transition-all duration-200 rounded-xl cursor-pointer active:scale-[0.96] group hover:bg-black/[0.03]">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] transition-colors duration-200"
          style={{ color: active ? '#2ED05D' : '#FB923C' }}>
          {group.label}
        </span>
        <svg
          className={`w-3 h-3 transition-[color,transform] duration-300 ${open ? 'rotate-180' : ''}`}
          style={{ color: active ? '#2ED05D' : '#FB923C' }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className={`flex flex-col gap-0.5 mt-0.5 overflow-hidden transition-[grid-template-rows,opacity] duration-300 ${open ? '' : 'hidden'}`}>
        {group.items.map((item, idx) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-[9px] rounded-[999px] text-sm font-semibold transition-all duration-200
              ${isActive ? 'text-white' : 'text-[#475569] hover:text-[#C2410C] hover:bg-[#FFF7ED]'}`
            }
            style={({ isActive }) => ({
              background: isActive ? 'linear-gradient(135deg, #2ED05D, #22C55E)' : undefined,
              boxShadow: isActive ? '0 2px 8px rgba(46,208,93,0.25)' : undefined,
              animationDelay: `${styleDelay + 40 + idx * 30}ms`,
            })}
          >
            {({ isActive }) => (
              <span className="flex items-center gap-3 w-full">
                <Icon d={icons[item.icon]}
                  className="w-4 h-4 flex-shrink-0 transition-transform duration-200"
                  style={{ color: isActive ? '#ffffff' : '#FB923C' }} />
                <span className="truncate">{item.label}</span>
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const { user } = useAuth();
  const { school_name } = useSettings();

  const roles = user?.roles || [];
  const allowedPages = getAllowedPages(roles);
  const isFullAccess = allowedPages === '*';

  const filteredGroups = navGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => isFullAccess || allowedPages.includes(item.path)),
    }))
    .filter(group => group.items.length > 0);

  return (
    <aside className="fixed left-0 top-0 h-screen flex flex-col z-10 overflow-hidden"
      style={{ background: '#F7F9FC', width: '250px' }}>
      <div className="flex items-center px-4 pt-5 pb-4 gap-3 flex-shrink-0 animate-in" style={{ animationDelay: '0ms' }}>
        <div className="w-9 h-9 rounded-[10px] bg-[#E8F9ED] flex items-center justify-center flex-shrink-0 transition-transform duration-200 hover:scale-105 active:scale-[0.96]">
          <svg className="w-5 h-5 text-[#2ED05D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <div>
          <p className="text-base font-bold text-[#1F2A44] leading-none">{school_name || 'SchoolERP'}</p>
          <p className="text-[10px] mt-[3px] text-[#94A3B8] tracking-[0.06em]">School Management</p>
        </div>
      </div>

      <div className="mx-4 mb-1 h-px bg-[#E8ECF1]" />

      <nav className="flex-1 min-h-0 overflow-y-auto px-2 py-1 flex flex-col gap-0.5"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#E8ECF1 transparent' }}>
        {filteredGroups.map((group, i) => (
          <GroupSection key={group.label} group={group} defaultOpen={i < 3} styleDelay={60 + i * 40} />
        ))}
      </nav>

    </aside>
  );
}