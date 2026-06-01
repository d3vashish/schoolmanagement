import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  useStudentProfile, 
  useStudentAttendance, 
  useStudentFees, 
  useStudentLeaves 
} from '../hooks/useStudents';
import { useBookIssues } from '../hooks/useLibrary';

const Icons = {
  Back: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
  Mail: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  Phone: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
  MapPin: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  User: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  CheckCircle: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  DollarSign: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Book: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
};

const MetricCard = ({ title, value, subtext, icon, color, bg }) => (
  <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-start gap-4 transition-transform hover:-translate-y-1 hover:shadow-md cursor-pointer">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${bg} ${color}`}>{icon}</div>
    <div>
      <p className="text-sm font-semibold text-gray-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-gray-900 leading-none">{value}</h3>
      {subtext && <p className="text-xs text-gray-400 mt-2 font-medium">{subtext}</p>}
    </div>
  </div>
);

const DetailRow = ({ icon, label, value }) => (
  <div className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
    <div className="text-gray-400 shrink-0">{icon}</div>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-gray-500 font-medium mb-0.5">{label}</p>
      <p className="text-sm text-gray-900 font-semibold truncate">{value || '—'}</p>
    </div>
  </div>
);

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Overview');

  const { data: profile, isLoading: profileLoading } = useStudentProfile(id);
  const { data: attendance = [] } = useStudentAttendance(id);
  const { data: fees = [] } = useStudentFees(id);
  const { data: libraryIssues = [] } = useBookIssues({ user_id: profile?.user_id || id }, { enabled: !!profile?.user_id });
  const { data: leaves = [] } = useStudentLeaves(id);

  if (profileLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
        <p className="text-gray-500 font-medium animate-pulse">Loading Student Profile...</p>
      </div>
    );
  }

  if (!profile) return <div className="p-8 text-center text-red-500">Failed to load student profile.</div>;

  const initials = (profile.first_name?.[0] || '') + (profile.last_name?.[0] || '');
  const presentDays = attendance.filter(a => a.status === 'Present').length;
  const attPct = attendance.length > 0 ? Math.round((presentDays / attendance.length) * 100) : 0;
  
  const totalFees = fees.reduce((sum, f) => sum + (f.gross_amount || 0), 0);
  const paidFees = fees.reduce((sum, f) => sum + (f.status === 'Paid' ? f.gross_amount : 0), 0);
  const pendingFees = totalFees - paidFees;
  
  const activeIssues = libraryIssues.filter(i => i.status === 'issued' || i.status === 'overdue').length;

  const tabs = ['Overview', 'Attendance', 'Fees', 'Library', 'Leaves'];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors font-medium">
          <Icons.Back /> <span className="text-sm">Back</span>
        </button>
        <div className="flex gap-2">
          <button onClick={() => navigate(`/messaging?to=${profile.user_id || profile.id}`)} className="btn-secondary px-4 py-2 text-sm font-semibold flex items-center gap-2">
            <Icons.Mail /> Message
          </button>
        </div>
      </div>

      {/* Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-white shadow-sm border border-gray-200">
        <div className="h-40 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-800 relative">
          <div className="absolute inset-0 bg-white/10 pattern-grid-lg"></div>
        </div>

        <div className="px-8 pb-8 pt-20 relative">
          <div className="absolute -top-16 left-8 p-1.5 bg-white rounded-full shadow-md">
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 text-indigo-600 flex items-center justify-center text-4xl font-bold border border-indigo-50">
              {initials || 'S'}
            </div>
            <div className={`absolute bottom-3 right-3 w-5 h-5 rounded-full border-4 border-white ${profile.enabled ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
          </div>

          <div className="flex flex-col md:flex-row md:justify-between md:items-start ml-0 mt-4 md:mt-0 md:ml-36 gap-4">
            <div>
              <div className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-1">Student Profile</div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight -mt-1">{profile.student_name}</h1>
              <p className="text-gray-500 text-base mt-1 font-medium flex items-center gap-2">
                Class: {profile.student_group}
                {profile.admission_number && <span className="px-2 py-0.5 bg-gray-100 rounded text-xs ml-2 text-gray-600">ID: {profile.admission_number}</span>}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <div onClick={() => setActiveTab('Attendance')}>
          <MetricCard title="Attendance" value={`${attPct}%`} subtext={`${presentDays} days present`} icon={<Icons.CheckCircle />} color="text-emerald-600" bg="bg-emerald-50" />
        </div>
        <div onClick={() => setActiveTab('Fees')}>
          <MetricCard title="Pending Fees" value={`₹${pendingFees.toLocaleString()}`} subtext={`${paidFees.toLocaleString()} paid`} icon={<Icons.DollarSign />} color={pendingFees > 0 ? "text-rose-600" : "text-emerald-600"} bg={pendingFees > 0 ? "bg-rose-50" : "bg-emerald-50"} />
        </div>
        <div onClick={() => setActiveTab('Library')}>
          <MetricCard title="Active Books" value={activeIssues} subtext="Currently issued" icon={<Icons.Book />} color="text-indigo-600" bg="bg-indigo-50" />
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Identity & Contact</h3>
            </div>
            <div className="px-6 py-2">
              <DetailRow icon={<Icons.Mail />} label="Email Address" value={profile.student_email_id} />
              <DetailRow icon={<Icons.MapPin />} label="Address" value={profile.address} />
              <DetailRow icon={<Icons.User />} label="Date of Birth" value={profile.date_of_birth?.split('T')[0]} />
            </div>
          </div>

          {profile.guardians && profile.guardians.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Guardian Details</h3>
              </div>
              <div className="px-6 py-2">
                {profile.guardians.map((g, i) => (
                  <div key={i}>
                    <DetailRow icon={<Icons.User />} label="Guardian Name" value={g.guardian} />
                    <DetailRow icon={<Icons.Phone />} label="Mobile Number" value={g.mobile} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Content Area */}
        <div className="lg:col-span-2">
          <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto hide-scrollbar">
            {tabs.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 font-semibold text-sm whitespace-nowrap transition-colors relative ${activeTab === tab ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-800'}`}>
                {tab}
                {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full"></div>}
              </button>
            ))}
          </div>

          <div className="space-y-6">
            {activeTab === 'Overview' && (
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-5">Quick Overview</h3>
                <p className="text-gray-500 text-sm">Select a tab above to view detailed records for Attendance, Fees, Library, or Leaves.</p>
              </div>
            )}
            
            {activeTab === 'Attendance' && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex justify-between">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Recent Attendance</h3>
                  <button onClick={() => navigate('/attendance')} className="text-xs text-indigo-600 font-semibold hover:underline">Mark Attendance &rarr;</button>
                </div>
                {attendance.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 font-medium">No attendance records found.</div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 bg-white">
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Date</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {attendance.map((a, i) => (
                        <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4 font-medium text-gray-900 text-sm">{a.date}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${a.status === 'Present' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                              {a.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === 'Fees' && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex justify-between">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Fee Invoices</h3>
                  <button onClick={() => navigate('/fees')} className="text-xs text-indigo-600 font-semibold hover:underline">Manage Fees &rarr;</button>
                </div>
                {fees.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 font-medium">No fee records found.</div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 bg-white">
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Invoice</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Amount</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Status</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Due Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {fees.map((f, i) => (
                        <tr key={i} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => navigate('/fees')}>
                          <td className="px-6 py-4 font-medium text-gray-900 text-sm">{f.name}</td>
                          <td className="px-6 py-4 text-gray-900 font-bold text-sm">₹{f.gross_amount?.toLocaleString()}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${f.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {f.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-500 text-sm">{f.due_date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === 'Library' && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex justify-between">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Library Books</h3>
                  <button onClick={() => navigate('/library')} className="text-xs text-indigo-600 font-semibold hover:underline">Open Library &rarr;</button>
                </div>
                {libraryIssues.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 font-medium">No library issues found.</div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 bg-white">
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Book</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Issued Date</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {libraryIssues.map((l, i) => (
                        <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4 font-medium text-gray-900 text-sm">{l.book_title || l.book_id}</td>
                          <td className="px-6 py-4 text-gray-500 text-sm">{l.issue_date?.split('T')[0]}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${l.status === 'returned' ? 'bg-emerald-100 text-emerald-700' : l.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                              {l.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
            
            {activeTab === 'Leaves' && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Leave Applications</h3>
                </div>
                {leaves.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 font-medium">No leave applications found.</div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 bg-white">
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Date</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Type</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {leaves.map((l, i) => (
                        <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4 text-gray-900 font-medium text-sm">{l.from_date} <span className="text-gray-400 mx-1">→</span> {l.to_date}</td>
                          <td className="px-6 py-4 text-gray-600 text-sm">{l.leave_type}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${l.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : l.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                              {l.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
