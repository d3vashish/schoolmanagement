import { useState } from 'react';
import { useUserFines } from '../../hooks/useLibrary';

export default function FinesPanel({ show, onClose }) {
  const [userId, setUserId] = useState('');
  const [searchedId, setSearchedId] = useState('');

  const { data: fines = [], isLoading } = useUserFines(searchedId, { enabled: show && !!searchedId });

  if (!show) return null;

  const totalUnpaid = fines.filter(f => f.status === 'unpaid').reduce((s, f) => s + Number(f.amount), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-[#2D2A24]">Fines & Penalties</h3>
          <button onClick={onClose} className="p-2 text-[#8A8680] hover:text-[#2D2A24] transition-colors cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* User search */}
        <div className="flex gap-2 mb-6">
          <input type="text" value={userId} onChange={e => setUserId(e.target.value)}
            className="input text-sm flex-1" placeholder="Enter user ID or email…"
            onKeyDown={e => e.key === 'Enter' && userId && setSearchedId(userId)} />
          <button onClick={() => userId && setSearchedId(userId)}
            className="px-4 py-2.5 rounded-xl text-sm font-bold bg-[#2ED05D] text-white hover:bg-[#25B04E] transition-colors cursor-pointer">
            Search
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <span className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : searchedId && fines.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-sm font-semibold text-[#2D2A24]">No fines found</p>
            <p className="text-xs text-[#8A8680] mt-1">This user has no outstanding fines.</p>
          </div>
        ) : fines.length > 0 ? (
          <>
            {/* Summary */}
            {totalUnpaid > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                <p className="text-sm font-bold text-red-700">Total unpaid: ₹{totalUnpaid.toLocaleString('en-IN')}</p>
              </div>
            )}

            <div className="space-y-2">
              {fines.map(f => (
                <div key={f.id} className="flex items-center justify-between p-3 rounded-xl border border-[#f1f5f9]">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#2D2A24] truncate">{f.book_title || 'Fine'}</p>
                    <p className="text-xs text-[#8A8680]">{f.reason || 'Overdue'}</p>
                    <p className="text-xs text-[#8A8680]">{new Date(f.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-bold text-[#2D2A24]">₹{Number(f.amount).toLocaleString('en-IN')}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      f.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {f.status === 'paid' ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : searchedId ? null : (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-sm font-medium text-[#8A8680]">Search for a user to view fines</p>
          </div>
        )}
      </div>
    </div>
  );
}
