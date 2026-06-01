import { useState } from 'react';
import { useReturnBook, useBookIssues } from '../../hooks/useLibrary';

export default function ReturnBookModal({ show, onClose, onSuccess }) {
  const [search, setSearch] = useState('');
  const { data: issues = [], isLoading } = useBookIssues({ status: 'issued' }, { enabled: show });

  const returnMutation = useReturnBook({
    onSuccess: () => { setSearch(''); onClose?.(); onSuccess?.(); },
  });

  if (!show) return null;

  const filtered = issues.filter(i =>
    !search || i.book_title?.toLowerCase().includes(search.toLowerCase()) || i.user_name?.toLowerCase().includes(search.toLowerCase()) || i.copy_barcode?.toLowerCase().includes(search.toLowerCase())
  );

  const today = new Date();
  const calcFine = (issue) => {
    if (!issue.expected_return_date) return 0;
    const due = new Date(issue.expected_return_date);
    const diff = Math.floor((today - due) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff * 5 : 0; // ₹5/day overdue fine
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-[#2D2A24]">Return Book</h3>
          <button onClick={onClose} className="p-2 text-[#8A8680] hover:text-[#2D2A24] transition-colors cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8680]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="Search by book title, user, or barcode…" value={search}
            onChange={e => setSearch(e.target.value)} className="input pl-9 text-sm w-full" />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <span className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm font-medium text-[#8A8680]">{search ? 'No matching issued books' : 'No books currently issued'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(issue => {
              const fine = calcFine(issue);
              return (
                <div key={issue.id}
                  className="flex items-center gap-4 p-4 rounded-xl border border-[#f1f5f9] hover:bg-[#F7F9FC] transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#2D2A24] text-sm truncate">{issue.book_title}</p>
                    <p className="text-xs text-[#8A8680] mt-0.5">
                      Issued to: {issue.user_name || issue.user_id} 
                      {issue.copy_barcode && ` · Barcode: ${issue.copy_barcode}`}
                    </p>
                    <p className="text-xs text-[#8A8680]">
                      Issued: {new Date(issue.issue_date).toLocaleDateString()} 
                      {issue.expected_return_date && ` · Due: ${new Date(issue.expected_return_date).toLocaleDateString()}`}
                    </p>
                    {fine > 0 && (
                      <p className="text-xs font-bold text-red-600 mt-1">
                        Overdue fine: ₹{fine} ({Math.ceil(fine / 5)} days overdue @ ₹5/day)
                      </p>
                    )}
                  </div>
                  <button onClick={() => {
                    if (fine > 0 && !window.confirm(`This book has an overdue fine of ₹${fine}. Proceed with return?`)) return;
                    returnMutation.mutate(issue.id);
                  }}
                    disabled={returnMutation.isPending}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50 shrink-0 cursor-pointer">
                    {returnMutation.isPending ? '…' : 'Return'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
