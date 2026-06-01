import { useState } from 'react';
import { useNotificationPrefs, useUpdateNotificationPrefs, useCirculars, useCreateCircular } from '../hooks/useMessaging';
import CircularModal from '../components/CircularModal';

export default function Notifications() {
  const { data: prefs, isLoading: prefsLoading } = useNotificationPrefs();
  const updatePrefs = useUpdateNotificationPrefs();
  const { data: circulars = [], isLoading: circularsLoading } = useCirculars();
  const createCircular = useCreateCircular();

  const [showCircularModal, setShowCircularModal] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const channels = [
    { key: 'sms_enabled', label: 'SMS', icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { key: 'email_enabled', label: 'Email', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    { key: 'push_enabled', label: 'Push', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  ];

  const eventTypes = [
    { label: 'Fee Payments', desc: 'Payment confirmation & receipts' },
    { label: 'Attendance', desc: 'Daily attendance reports' },
    { label: 'Homework', desc: 'New assignments & submissions' },
    { label: 'Exam Results', desc: 'Results & report cards' },
    { label: 'Circulars', desc: 'School-wide announcements' },
    { label: 'Leave Requests', desc: 'Leave application status' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl text-sm font-semibold bg-[#2D2A24] text-white shadow-[0_8px_32px_rgba(0,0,0,0.2)] animate-fade-in-up">
          {toast}
        </div>
      )}

      <div className="flex items-end justify-between">
        <div>
          <div className="eyebrow">Communication</div>
          <h1 className="text-[2rem] sm:text-[2.5rem] font-extrabold text-[#2D2A24] tracking-tight leading-[1.1] -mt-1">Notifications</h1>
          <p className="text-[#8A8680] mt-2 font-medium text-sm">Notification preferences & circulars</p>
        </div>
      </div>

      {/* ── Notification Channels ── */}
      <div className="bg-white rounded-[28px] border border-[#f1f5f9] p-6">
        <h2 className="text-lg font-extrabold text-[#2D2A24] mb-4">Notification Channels</h2>
        <div className="grid grid-cols-3 gap-4">
          {channels.map(ch => (
            <div key={ch.key} className={`rounded-2xl border p-5 ${ch.color} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={ch.icon} />
                </svg>
                <span className="font-bold">{ch.label}</span>
              </div>
              <button onClick={() => {
                updatePrefs.mutate({ ...prefs, [ch.key]: !prefs?.[ch.key] });
                showToast(`${ch.label} ${prefs?.[ch.key] ? 'disabled' : 'enabled'}`);
              }}
                className={`w-11 h-6 rounded-full transition-colors relative ${prefs?.[ch.key] ? 'bg-[#2ED05D]' : 'bg-gray-200'}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${prefs?.[ch.key] ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Event Types ── */}
      <div className="bg-white rounded-[28px] border border-[#f1f5f9] p-6">
        <h2 className="text-lg font-extrabold text-[#2D2A24] mb-4">Notification Events</h2>
        <p className="text-sm text-[#8A8680] mb-4">These event types determine what notifications you receive through the enabled channels.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {eventTypes.map(ev => (
            <div key={ev.label} className="rounded-xl bg-[#F7F9FC] px-4 py-3 flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${prefs?.[ev.label] !== false ? 'bg-[#2ED05D]' : 'bg-gray-300'}`} />
              <div>
                <p className="text-sm font-semibold text-[#2D2A24]">{ev.label}</p>
                <p className="text-xs text-[#8A8680]">{ev.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Circulars ── */}
      <div className="bg-white rounded-[28px] border border-[#f1f5f9] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-extrabold text-[#2D2A24]">Circulars</h2>
            <p className="text-xs font-medium text-[#8A8680]">School-wide announcements & notices</p>
          </div>
          <button onClick={() => setShowCircularModal(true)}
            className="px-4 py-2.5 rounded-xl text-sm font-bold bg-[#2ED05D] text-white hover:bg-[#25B04E] transition-colors cursor-pointer">
            + New Circular
          </button>
        </div>

        {circularsLoading ? (
          <div className="flex items-center justify-center py-8"><span className="w-6 h-6 border-2 border-[#2ED05D] border-t-transparent rounded-full animate-spin" /></div>
        ) : circulars.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-[56px] h-[56px] rounded-[16px] bg-[#E8F9ED] flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-[#2ED05D]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[#8A8680]">No circulars yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {circulars.map(c => (
              <div key={c.id} className="rounded-2xl bg-[#F7F9FC] px-5 py-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-[#2D2A24]">{c.title}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {c.is_published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  <p className="text-xs text-[#8A8680] line-clamp-2">{c.body}</p>
                  <div className="flex items-center gap-3 mt-2">
                    {c.target_class && <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">{c.target_class}</span>}
                    {c.created_at && <span className="text-[10px] text-[#B0ABA4]">{new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                  </div>
                </div>
                {c.attachment_url && (
                  <a href={c.attachment_url} target="_blank" rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-white border border-[#e2e8f0] text-[#8A8680] hover:text-[#2ED05D] transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <CircularModal show={showCircularModal} onClose={() => { setShowCircularModal(false); showToast('Circular created!'); }}
        onSubmit={(data) => createCircular.mutate(data, { onSuccess: () => setShowCircularModal(false) })} />
    </div>
  );
}
