import { useState, useEffect } from 'react';
import { useIssueBook, useBookList } from '../../hooks/useLibrary';

export default function IssueBookModal({ show, onClose, onSuccess, book }) {
  const [form, setForm] = useState({ copy_id: '', user_id: '', expected_return_date: '' });

  useEffect(() => {
    if (show && book?.id) setForm(f => ({ ...f, copy_id: book.id }));
  }, [book?.id, show]);
  const { data: books = [] } = useBookList({}, { enabled: show });

  const issueMutation = useIssueBook({
    onSuccess: () => { setForm({ copy_id: '', user_id: '', expected_return_date: '' }); onClose?.(); onSuccess?.(); },
  });

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-[#2D2A24]">Issue Book</h3>
          <button onClick={onClose} className="p-2 text-[#8A8680] hover:text-[#2D2A24] transition-colors cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Book *</label>
            <select value={form.copy_id} onChange={e => setForm(f => ({ ...f, copy_id: e.target.value }))}
              className="input text-sm w-full">
              <option value="">Select book copy</option>
              {books.filter(b => b.available_copies > 0).flatMap(b =>
                Array.from({ length: b.available_copies }, (_, i) => (
                  <option key={`${b.id}-${i}`} value={b.id}>{b.title} — {b.author} (copy {i + 1})</option>
                ))
              )}
            </select>
            {book && (
              <p className="text-xs text-[#8A8680] mt-1">Pre-selected: <strong>{book.title}</strong></p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Copy ID (UUID)</label>
            <input type="text" value={form.copy_id} onChange={e => setForm(f => ({ ...f, copy_id: e.target.value }))}
              className="input text-sm w-full" placeholder="BookCopy UUID from barcode scan" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">User / Member ID *</label>
            <input type="text" value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))}
              className="input text-sm w-full" placeholder="User email or ID" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Expected Return Date</label>
            <input type="date" value={form.expected_return_date} onChange={e => setForm(f => ({ ...f, expected_return_date: e.target.value }))}
              className="input text-sm w-full" />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#f1f5f9]">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Cancel</button>
          <button onClick={() => issueMutation.mutate(form)}
            disabled={!form.copy_id || !form.user_id || issueMutation.isPending}
            className="btn-primary px-6 py-2.5 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed">
            {issueMutation.isPending ? 'Issuing…' : 'Issue Book'}
          </button>
        </div>

        {issueMutation.isError && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {issueMutation.error?.message || 'Failed to issue book'}
          </div>
        )}
      </div>
    </div>
  );
}
