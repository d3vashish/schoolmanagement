import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMessageThreads, useThreadMessages, useSendMessage, useCreateMessageThread, useMarkThreadRead } from '../hooks/useMessaging';

export default function Messaging() {
  const { user } = useAuth();
  const role = user?.role || 'teacher';

  const [selectedThread, setSelectedThread] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newChildId, setNewChildId] = useState('');
  const [newChildName, setNewChildName] = useState('');
  const [newMessage, setNewMessage] = useState('');

  const { data: threads = [], isLoading } = useMessageThreads();
  const { data: messages = [] } = useThreadMessages(selectedThread?.id);
  const sendMutation = useSendMessage();
  const createMutation = useCreateMessageThread();
  const markRead = useMarkThreadRead();

  const handleSelectThread = (t) => {
    setSelectedThread(t);
    if (t.unread_count > 0) markRead.mutate(t.id);
  };

  const handleSend = () => {
    if (!replyText.trim() || !selectedThread) return;
    sendMutation.mutate({
      thread_id: selectedThread.id,
      sender_id: user?.email || '',
      sender_name: user?.full_name || user?.usr || '',
      sender_role: role,
      message: replyText.trim(),
    }, { onSuccess: () => setReplyText('') });
  };

  const handleCreateThread = () => {
    if (!newSubject.trim() || !newMessage.trim()) return;
    createMutation.mutate({
      child_id: newChildId || newChildName,
      teacher_id: role === 'teacher' ? '' : user?.email,
      parent_id: role === 'parent' ? user?.email : '',
      parent_name: role === 'parent' ? user?.full_name || user?.usr : '',
      subject: newSubject.trim(),
      message: newMessage.trim(),
    }, { onSuccess: () => { setShowNew(false); setNewSubject(''); setNewChildId(''); setNewChildName(''); setNewMessage(''); }});
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div className="flex items-end justify-between">
        <div>
          <div className="eyebrow">Communication</div>
          <h1 className="text-[2rem] sm:text-[2.5rem] font-extrabold text-[#2D2A24] tracking-tight leading-[1.1] -mt-1">Messaging</h1>
          <p className="text-[#8A8680] mt-2 font-medium text-sm">
            {role === 'teacher' ? 'Parent conversations' : role === 'parent' ? 'Message your child\'s teacher' : 'Messages'}
          </p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="px-4 py-2.5 rounded-xl text-sm font-bold bg-[#2ED05D] text-white hover:bg-[#25B04E] transition-colors cursor-pointer">
          + New Message
        </button>
      </div>

      <div className="flex gap-6">
        {/* Threads sidebar */}
        <div className="w-80 shrink-0 bg-white rounded-[28px] border border-[#f1f5f9] overflow-hidden" style={{ maxHeight: 'calc(100vh - 260px)' }}>
          <div className="p-3 border-b border-[#f1f5f9]">
            <p className="text-xs font-bold text-[#8A8680] uppercase tracking-wide">{threads.length} Conversations</p>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
            {isLoading ? (
              <div className="flex items-center justify-center py-12"><span className="w-6 h-6 border-2 border-[#2ED05D] border-t-transparent rounded-full animate-spin" /></div>
            ) : threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <p className="text-sm font-medium text-[#8A8680]">No conversations yet</p>
              </div>
            ) : threads.map(t => (
              <button key={t.id} onClick={() => handleSelectThread(t)}
                className={`w-full text-left px-4 py-3 border-b border-[#f1f5f9] hover:bg-[#F7F9FC] transition-colors ${selectedThread?.id === t.id ? 'bg-[#E8F9ED]' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-[#2D2A24] truncate">{t.subject || t.child_name || 'Conversation'}</p>
                    <p className="text-xs font-medium text-[#8A8680] truncate mt-0.5">
                      {t.parent_name || t.teacher_name || t.child_name}
                      {t.child_name && ` · ${t.child_name}`}
                    </p>
                  </div>
                  {t.unread_count > 0 && (
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-[#2ED05D] text-white shrink-0">{t.unread_count}</span>
                  )}
                </div>
                {t.last_message && <p className="text-xs text-[#B0ABA4] truncate mt-1">{t.last_message}</p>}
              </button>
            ))}
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 bg-white rounded-[28px] border border-[#f1f5f9] overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 260px)' }}>
          {selectedThread ? (
            <>
              {/* Thread header */}
              <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold text-[#2D2A24]">{selectedThread.subject || selectedThread.child_name}</p>
                  <p className="text-xs font-medium text-[#8A8680]">
                    {selectedThread.parent_name && `Parent: ${selectedThread.parent_name}`}
                    {selectedThread.teacher_name && ` · Teacher: ${selectedThread.teacher_name}`}
                    {selectedThread.child_name && ` · Child: ${selectedThread.child_name}`}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4" style={{ maxHeight: 'calc(100vh - 400px)' }}>
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center py-12"><p className="text-sm font-medium text-[#8A8680]">No messages yet</p></div>
                ) : messages.map(m => {
                  const isMe = m.sender_id === user?.email || m.sender_id === user?.usr;
                  return (
                    <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] px-4 py-3 rounded-2xl ${isMe ? 'bg-[#2ED05D] text-white' : 'bg-[#F7F9FC] text-[#2D2A24]'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold ${isMe ? 'text-white/80' : 'text-[#8A8680]'}`}>{m.sender_name || m.sender_role}</span>
                          <span className={`text-[10px] ${isMe ? 'text-white/60' : 'text-[#B0ABA4]'}`}>
                            {m.created_at ? new Date(m.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply */}
              <div className="px-6 py-4 border-t border-[#f1f5f9] flex gap-3 items-end">
                <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                  placeholder="Type your reply…"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-[#e2e8f0] text-sm font-medium resize-none bg-[#F7F9FC] focus:border-[#2ED05D] focus:outline-none"
                  rows={2} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}} />
                <button onClick={handleSend} disabled={!replyText.trim() || sendMutation.isPending}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[#2ED05D] text-white hover:bg-[#25B04E] disabled:opacity-50 transition-colors cursor-pointer shrink-0">
                  Send
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-[72px] h-[72px] rounded-[20px] bg-[#E8F9ED] flex items-center justify-center mb-5">
                <svg className="w-8 h-8 text-[#2ED05D]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-[#2D2A24] mb-1">Select a conversation</h3>
              <p className="text-sm font-medium text-[#8A8680]">Choose a thread from the sidebar or start a new one.</p>
            </div>
          )}
        </div>
      </div>

      {/* New message modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-[28px] p-6 w-full max-w-md shadow-[0_16px_48px_rgba(0,0,0,0.1)]" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#2D2A24] mb-4">New Message</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#8A8680] uppercase tracking-wide mb-1 block">Subject</label>
                <input value={newSubject} onChange={e => setNewSubject(e.target.value)}
                  className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl focus:border-[#2ED05D]" placeholder="e.g. Progress Update" />
              </div>
              {role === 'parent' && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-[#8A8680] uppercase tracking-wide mb-1 block">Child Name / ID</label>
                    <input value={newChildName} onChange={e => setNewChildName(e.target.value)}
                      className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl focus:border-[#2ED05D]" placeholder="Your child's name" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#8A8680] uppercase tracking-wide mb-1 block">Teacher Email (optional)</label>
                    <input value={newChildId} onChange={e => setNewChildId(e.target.value)}
                      className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl focus:border-[#2ED05D]" placeholder="teacher@school.com" />
                  </div>
                </>
              )}
              <div>
                <label className="text-xs font-semibold text-[#8A8680] uppercase tracking-wide mb-1 block">Message</label>
                <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)}
                  className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl focus:border-[#2ED05D]" rows={4} placeholder="Write your message…" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowNew(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-bold bg-gray-100 text-[#475569] hover:bg-gray-200 transition-colors cursor-pointer">Cancel</button>
              <button onClick={handleCreateThread} disabled={!newSubject.trim() || !newMessage.trim()}
                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[#2ED05D] text-white hover:bg-[#25B04E] disabled:opacity-50 transition-colors cursor-pointer">Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
