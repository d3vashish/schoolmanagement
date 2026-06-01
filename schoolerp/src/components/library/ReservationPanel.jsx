import { useState, useEffect } from 'react';
import { useReserveBook, useBookIssues, useBookList } from '../../hooks/useLibrary';

export default function ReservationPanel({ show, onClose, book }) {
  const [form, setForm] = useState({ book_id: '', user_id: '' });

  useEffect(() => {
    if (show && book?.id) setForm(f => ({ ...f, book_id: book.id }));
  }, [book?.id, show]);
  const { data: books = [] } = useBookList({}, { enabled: show });
  const { data: reservations = [], isLoading } = useBookIssues({ status: 'reserved' }, { enabled: show });

  const reserveMutation = useReserveBook({
    onSuccess: () => { setForm({ book_id: '', user_id: '' }); },
  });

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-[#2D2A24]">Reserve Book</h3>
          <button onClick={onClose} className="p-2 text-[#8A8680] hover:text-[#2D2A24] transition-colors cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Reserve form */}
        <div className="bg-[#F7F9FC] rounded-xl p-4 mb-6">
          <h4 className="text-sm font-bold text-[#2D2A24] mb-3">New Reservation</h4>
          <div className="space-y-3">
            <select value={form.book_id} onChange={e => setForm(f => ({ ...f, book_id: e.target.value }))}
              className="input text-sm w-full">
              <option value="">Select book</option>
              {books.map(b => (
                <option key={b.id} value={b.id}>{b.title} ({b.available_copies}/{b.total_copies} avail)</option>
              ))}
            </select>
            <input type="text" value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))}
              className="input text-sm w-full" placeholder="User email or ID" />
            <button onClick={() => reserveMutation.mutate(form)}
              disabled={!form.book_id || !form.user_id || reserveMutation.isPending}
              className="w-full px-4 py-2.5 rounded-xl text-sm font-bold bg-[#2ED05D] text-white hover:bg-[#25B04E] transition-colors disabled:opacity-50 cursor-pointer">
              {reserveMutation.isPending ? 'Reserving…' : 'Reserve Book'}
            </button>
          </div>
        </div>

        {/* Reservations list */}
        <h4 className="text-sm font-bold text-[#2D2A24] mb-3">Current Reservations</h4>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <span className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : reservations.length === 0 ? (
          <p className="text-sm text-[#8A8680] text-center py-8">No active reservations</p>
        ) : (
          <div className="space-y-2">
            {reservations.map(r => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-xl border border-[#f1f5f9]">
                <div>
                  <p className="text-sm font-semibold text-[#2D2A24]">{r.book_title}</p>
                  <p className="text-xs text-[#8A8680]">By: {r.user_name || r.user_id}</p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                  Reserved
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
