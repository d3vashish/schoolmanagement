import { useState } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useParentChildAttendance, useParentChildFeeDues, useParentChildResults, useParentChildEligibility, useParentChildLeaves, useApplyParentChildLeave, useParentChildSchedule, useParentChildLibrary, useParentChildProfile } from '../hooks/useParentPortal';

const TABS = ['attendance', 'schedule', 'fees', 'results', 'library', 'leaves'];

export default function ParentChildView() {
  const { childId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'attendance';

  const [start, setStart] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0]; });
  const [end, setEnd] = useState(() => new Date().toISOString().split('T')[0]);
  const [leaveForm, setLeaveForm] = useState({ leave_type: 'Sick Leave', start_date: '', end_date: '', reason: '' });
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [toast, setToast] = useState('');

  const { data: attendance = [], isLoading: attLoading } = useParentChildAttendance(tab === 'attendance' ? childId : null, start, end);
  const { data: feeDues = [], isLoading: feesLoading } = useParentChildFeeDues(tab === 'fees' ? childId : null);
  const { data: results = [], isLoading: resultsLoading } = useParentChildResults(tab === 'results' ? childId : null);
  const { data: eligibility } = useParentChildEligibility(tab === 'results' ? childId : null);
  const { data: leaves = [], isLoading: leavesLoading } = useParentChildLeaves(tab === 'leaves' ? childId : null);
  const { data: schedule = [], isLoading: scheduleLoading } = useParentChildSchedule(tab === 'schedule' ? childId : null);
  const { data: library = { issues: [], fines: 0 }, isLoading: libraryLoading } = useParentChildLibrary(tab === 'library' ? childId : null);
  const { data: profile } = useParentChildProfile(childId);
  const applyLeave = useApplyParentChildLeave();

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };
  const navigate = useNavigate(); // wait, we need to import useNavigate

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {toast && <div className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl text-sm font-semibold bg-[#2D2A24] text-white shadow-[0_8px_32px_rgba(0,0,0,0.2)] animate-fade-in-up">{toast}</div>}

      <div className="flex items-start justify-between">
        <div>
          <Link to="/parent" className="flex items-center gap-2 text-sm font-semibold text-[#8A8680] hover:text-[#2D2A24] transition-colors mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Children
          </Link>
          <div className="eyebrow">Child Profile</div>
          <h1 className="text-[2rem] sm:text-[2.5rem] font-extrabold text-[#2D2A24] tracking-tight leading-[1.1] -mt-1">{profile?.student_name || childId}</h1>
          <p className="text-[#8A8680] font-medium mt-1">
            {profile?.student_group ? `Class: ${profile.student_group}` : ''}
          </p>
        </div>
        
        {profile?.class_teacher && (
          <div className="text-right">
            <p className="text-xs font-semibold text-[#8A8680] uppercase tracking-wide mb-1">Class Teacher</p>
            <button 
              onClick={() => navigate(`/users/${encodeURIComponent(profile.class_teacher)}`)}
              className="text-sm font-bold text-[#2D2A24] hover:text-[var(--color-primary)] flex items-center gap-1.5 transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center text-[10px]">
                {profile.class_teacher.charAt(0).toUpperCase()}
              </div>
              {profile.class_teacher}
            </button>
            <button 
              onClick={() => navigate(`/users/${encodeURIComponent(profile.class_teacher)}`)}
              className="mt-2 text-xs font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-3 py-1.5 rounded-lg hover:bg-[var(--color-primary)]/20 transition-colors"
            >
              Message Teacher
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F7F9FC] rounded-2xl p-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setSearchParams({ tab: t })}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer capitalize
              ${tab === t ? 'bg-white text-[#2D2A24] shadow-sm' : 'text-[#8A8680] hover:text-[#2D2A24]'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Attendance */}
      {tab === 'attendance' && (
        <div className="bg-white rounded-[28px] border border-[#f1f5f9] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold text-[#2D2A24]">Attendance</h2>
            <div className="flex items-center gap-2">
              <input type="date" value={start} onChange={e => setStart(e.target.value)}
                className="input py-1.5 px-3 text-xs font-medium border border-[#e2e8f0] rounded-lg" />
              <span className="text-xs text-[#8A8680]">to</span>
              <input type="date" value={end} onChange={e => setEnd(e.target.value)}
                className="input py-1.5 px-3 text-xs font-medium border border-[#e2e8f0] rounded-lg" />
            </div>
          </div>
          {attLoading ? <div className="flex justify-center py-8"><span className="w-6 h-6 border-2 border-[#2ED05D] border-t-transparent rounded-full animate-spin" /></div>
          : attendance.length === 0 ? <p className="text-sm text-[#8A8680] text-center py-8">No attendance records found.</p>
          : <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-[#F7F9FC] border-b border-[#f1f5f9]">
                  <th className="text-left px-4 py-2 font-semibold text-[#8A8680] text-xs">Date</th>
                  <th className="text-left px-4 py-2 font-semibold text-[#8A8680] text-xs">Status</th>
                </tr></thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {attendance.map(a => (
                    <tr key={a.id}>
                      <td className="px-4 py-2.5 font-medium text-[#2D2A24]">{new Date(a.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${a.status === 'Present' ? 'bg-emerald-100 text-emerald-700' : a.status === 'Absent' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{a.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
        </div>
      )}

      {/* Fees */}
      {tab === 'fees' && (
        <div className="bg-white rounded-[28px] border border-[#f1f5f9] p-6">
          <h2 className="text-lg font-extrabold text-[#2D2A24] mb-4">Fee Dues</h2>
          {feesLoading ? <div className="flex justify-center py-8"><span className="w-6 h-6 border-2 border-[#2ED05D] border-t-transparent rounded-full animate-spin" /></div>
          : feeDues.length === 0 ? <p className="text-sm text-[#8A8680] text-center py-8">No fee dues pending.</p>
          : <div className="space-y-3">
              {feeDues.map(f => (
                <div key={f.id} className="rounded-2xl bg-[#F7F9FC] px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-[#2D2A24]">{f.fee_type}</p>
                    <p className="text-xs text-[#8A8680]">Due: {new Date(f.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    {f.late_fee > 0 && <p className="text-xs font-semibold text-red-600 mt-0.5">Late fee: ₹{f.late_fee}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-[#2D2A24]">₹{f.amount?.toLocaleString?.() || f.amount}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${f.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{f.status}</span>
                  </div>
                </div>
              ))}
              <div className="rounded-2xl bg-[#E8F9ED] px-5 py-4 flex items-center justify-between">
                <p className="text-sm font-bold text-[#2D2A24]">Total Due</p>
                <p className="text-xl font-extrabold text-[#2D2A24]">₹{feeDues.filter(f => f.status !== 'Paid').reduce((s, f) => s + (f.amount || 0) + (f.late_fee || 0), 0).toLocaleString()}</p>
              </div>
            </div>}
        </div>
      )}

      {/* Results */}
      {tab === 'results' && (
        <div className="bg-white rounded-[28px] border border-[#f1f5f9] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold text-[#2D2A24]">Results</h2>
            {eligibility && (
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${eligibility.eligible ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {eligibility.eligible ? 'Eligible for Promotion' : 'Not Eligible'}
              </span>
            )}
          </div>
          {resultsLoading ? <div className="flex justify-center py-8"><span className="w-6 h-6 border-2 border-[#2ED05D] border-t-transparent rounded-full animate-spin" /></div>
          : results.length === 0 ? <p className="text-sm text-[#8A8680] text-center py-8">No results available.</p>
          : <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-[#F7F9FC] border-b border-[#f1f5f9]">
                  <th className="text-left px-4 py-2 font-semibold text-[#8A8680] text-xs">Exam</th>
                  <th className="text-left px-4 py-2 font-semibold text-[#8A8680] text-xs">Subject</th>
                  <th className="text-right px-4 py-2 font-semibold text-[#8A8680] text-xs">Marks</th>
                  <th className="text-right px-4 py-2 font-semibold text-[#8A8680] text-xs">Grade</th>
                  <th className="text-right px-4 py-2 font-semibold text-[#8A8680] text-xs">Rank</th>
                </tr></thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {results.map(r => (
                    <tr key={r.id}>
                      <td className="px-4 py-2.5 font-semibold text-[#2D2A24]">{r.exam_name}</td>
                      <td className="px-4 py-2.5 text-[#8A8680]">{r.subject}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-[#2D2A24]">{r.marks_obtained}/{r.max_marks}</td>
                      <td className="px-4 py-2.5 text-right"><span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{r.grade || '—'}</span></td>
                      <td className="px-4 py-2.5 text-right font-bold text-[#2D2A24]">{r.rank ? `#${r.rank}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
          {eligibility?.message && <p className="text-xs text-[#8A8680] mt-4">{eligibility.message}</p>}
        </div>
      )}

      {/* Schedule */}
      {tab === 'schedule' && (
        <div className="bg-white rounded-[28px] border border-[#f1f5f9] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold text-[#2D2A24]">Class Schedule</h2>
          </div>
          {scheduleLoading ? <div className="flex justify-center py-8"><span className="w-6 h-6 border-2 border-[#2ED05D] border-t-transparent rounded-full animate-spin" /></div>
          : schedule.length === 0 ? <p className="text-sm text-[#8A8680] text-center py-8">No schedule available.</p>
          : <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-[#F7F9FC] border-b border-[#f1f5f9]">
                  <th className="text-left px-4 py-2 font-semibold text-[#8A8680] text-xs">Day</th>
                  <th className="text-left px-4 py-2 font-semibold text-[#8A8680] text-xs">Subject</th>
                  <th className="text-left px-4 py-2 font-semibold text-[#8A8680] text-xs">Time</th>
                  <th className="text-left px-4 py-2 font-semibold text-[#8A8680] text-xs">Room</th>
                </tr></thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {schedule.map(s => (
                    <tr key={s.name}>
                      <td className="px-4 py-2.5 font-semibold text-[#2D2A24]">{s.day}</td>
                      <td className="px-4 py-2.5">
                        <p className="font-bold text-[#2D2A24]">{s.course}</p>
                      </td>
                      <td className="px-4 py-2.5 text-[#8A8680]">{s.from_time?.substring(0,5)} - {s.to_time?.substring(0,5)}</td>
                      <td className="px-4 py-2.5 text-[#8A8680]">{s.room || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
        </div>
      )}

      {/* Library */}
      {tab === 'library' && (
        <div className="bg-white rounded-[28px] border border-[#f1f5f9] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold text-[#2D2A24]">Library</h2>
            {library.fines > 0 && (
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-red-100 text-red-700">
                ₹{library.fines} Pending Fine
              </span>
            )}
          </div>
          {libraryLoading ? <div className="flex justify-center py-8"><span className="w-6 h-6 border-2 border-[#2ED05D] border-t-transparent rounded-full animate-spin" /></div>
          : library.issues.length === 0 ? <p className="text-sm text-[#8A8680] text-center py-8">No active book issues.</p>
          : <div className="space-y-3">
              {library.issues.map(issue => (
                <div key={issue.id || issue.name} className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 rounded-xl bg-[#F7F9FC]">
                  <div>
                    <p className="text-sm font-bold text-[#2D2A24]">{issue.book_name || issue.book}</p>
                    <p className="text-xs text-[#8A8680]">Issued: {new Date(issue.issue_date).toLocaleDateString()}</p>
                  </div>
                  <div className="mt-2 sm:mt-0 text-left sm:text-right">
                    <p className={`text-xs font-bold ${issue.status === 'Overdue' ? 'text-red-600' : 'text-emerald-600'}`}>
                      Due: {new Date(issue.due_date).toLocaleDateString()}
                    </p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${issue.status === 'Issued' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{issue.status}</span>
                  </div>
                </div>
              ))}
            </div>}
        </div>
      )}

      {/* Leaves */}
      {tab === 'leaves' && (
        <div className="bg-white rounded-[28px] border border-[#f1f5f9] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold text-[#2D2A24]">Leave History</h2>
            <button onClick={() => setShowLeaveForm(true)}
              className="px-4 py-2 rounded-xl text-sm font-bold bg-[#2ED05D] text-white hover:bg-[#25B04E] transition-colors cursor-pointer">+ Apply Leave</button>
          </div>
          {leavesLoading ? <div className="flex justify-center py-8"><span className="w-6 h-6 border-2 border-[#2ED05D] border-t-transparent rounded-full animate-spin" /></div>
          : leaves.length === 0 ? <p className="text-sm text-[#8A8680] text-center py-8">No leave applications.</p>
          : <div className="space-y-2">
              {leaves.map(l => (
                <div key={l.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#F7F9FC]">
                  <div>
                    <p className="text-sm font-bold text-[#2D2A24]">{l.leave_type}</p>
                    <p className="text-xs text-[#8A8680]">{new Date(l.start_date).toLocaleDateString()} - {new Date(l.end_date).toLocaleDateString()}</p>
                    {l.reason && <p className="text-xs text-[#B0ABA4] mt-0.5">{l.reason}</p>}
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${l.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : l.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{l.status}</span>
                </div>
              ))}
            </div>}

          {/* Leave form modal */}
          {showLeaveForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setShowLeaveForm(false)}>
              <div className="bg-white rounded-[28px] p-6 w-full max-w-md shadow-[0_16px_48px_rgba(0,0,0,0.1)]" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-extrabold text-[#2D2A24] mb-4">Apply Leave</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-[#8A8680] uppercase tracking-wide mb-1 block">Leave Type</label>
                    <select value={leaveForm.leave_type} onChange={e => setLeaveForm(f => ({ ...f, leave_type: e.target.value }))}
                      className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl">
                      <option>Sick Leave</option><option>Casual Leave</option><option>Emergency Leave</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-[#8A8680] uppercase tracking-wide mb-1 block">Start Date</label>
                      <input type="date" value={leaveForm.start_date} onChange={e => setLeaveForm(f => ({ ...f, start_date: e.target.value }))}
                        className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[#8A8680] uppercase tracking-wide mb-1 block">End Date</label>
                      <input type="date" value={leaveForm.end_date} onChange={e => setLeaveForm(f => ({ ...f, end_date: e.target.value }))}
                        className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#8A8680] uppercase tracking-wide mb-1 block">Reason</label>
                    <textarea value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))} rows={3}
                      className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl resize-none" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => setShowLeaveForm(false)}
                    className="px-4 py-2.5 rounded-xl text-sm font-bold bg-gray-100 text-[#475569] hover:bg-gray-200 transition-colors cursor-pointer">Cancel</button>
                  <button onClick={() => {
                    applyLeave.mutate({ childId, data: leaveForm }, { onSuccess: () => { setShowLeaveForm(false); setLeaveForm({ leave_type: 'Sick Leave', start_date: '', end_date: '', reason: '' }); showToast('Leave applied!'); } });
                  }} disabled={!leaveForm.start_date || !leaveForm.end_date}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[#2ED05D] text-white hover:bg-[#25B04E] disabled:opacity-50 transition-colors cursor-pointer">Apply</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
