import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useParentChildren } from '../hooks/useParentPortal';

export default function ParentDashboard() {
  const { data: children = [], isLoading } = useParentChildren();

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div>
        <div className="eyebrow">Parent Portal</div>
        <h1 className="text-[2rem] sm:text-[2.5rem] font-extrabold text-[#2D2A24] tracking-tight leading-[1.1] -mt-1">My Children</h1>
        <p className="text-[#8A8680] mt-2 font-medium text-sm">{children.length} {children.length === 1 ? 'child' : 'children'} enrolled</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><span className="w-8 h-8 border-2 border-[#2ED05D] border-t-transparent rounded-full animate-spin" /></div>
      ) : children.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-[28px] border border-[#f1f5f9]">
          <div className="w-[72px] h-[72px] rounded-[20px] bg-[#E8F9ED] flex items-center justify-center mb-5">
            <svg className="w-8 h-8 text-[#2ED05D]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-[#2D2A24] mb-1">No children linked</h3>
          <p className="text-sm font-medium text-[#8A8680]">Please contact the school to link your children.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {children.map(c => (
            <Link key={c.id} to={`/parent/child/${c.id}`}
              className="bg-white rounded-[28px] border border-[#f1f5f9] p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-all duration-200 group">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#2ED05D]/20 to-[#22C55E]/10 flex items-center justify-center text-lg font-extrabold text-[#2ED05D]">
                  {c.child_name?.charAt(0) || '?'}
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-[#2D2A24] group-hover:text-[#2ED05D] transition-colors">{c.child_name}</h2>
                  <p className="text-sm font-medium text-[#8A8680]">{c.class_name}{c.section_name ? ` · ${c.section_name}` : ''}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-[#F7F9FC] px-3 py-2.5 text-center">
                  <p className="text-lg font-bold text-[#2D2A24]">{c.attendance_percentage}%</p>
                  <p className="text-[10px] font-semibold text-[#8A8680] uppercase">Attendance</p>
                </div>
                <div className="rounded-xl bg-[#F7F9FC] px-3 py-2.5 text-center">
                  <p className={`text-lg font-bold ${c.fee_due > 0 ? 'text-red-600' : 'text-[#2D2A24]'}`}>₹{c.fee_due?.toLocaleString?.() || 0}</p>
                  <p className="text-[10px] font-semibold text-[#8A8680] uppercase">Fee Due</p>
                </div>
                <div className="rounded-xl bg-[#F7F9FC] px-3 py-2.5 text-center">
                  <p className="text-lg font-bold text-[#2D2A24]">{c.last_result?.grade || '—'}</p>
                  <p className="text-[10px] font-semibold text-[#8A8680] uppercase">Last Grade</p>
                </div>
              </div>

              <div className="flex gap-2 mt-4 pt-3 border-t border-[#f1f5f9]">
                {[
                  { to: `/parent/child/${c.id}?tab=attendance`, label: 'Attendance' },
                  { to: `/parent/child/${c.id}?tab=fees`, label: 'Fees' },
                  { to: `/parent/child/${c.id}?tab=results`, label: 'Results' },
                ].map(link => (
                  <span key={link.label}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#E8F9ED] text-[#25B04E]">
                    {link.label}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
