import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useBookList, useBookCategories, useBookIssues } from '../hooks/useLibrary';
import BookCard from '../components/library/BookCard';
import BookFormModal from '../components/library/BookFormModal';
import IssueBookModal from '../components/library/IssueBookModal';
import ReturnBookModal from '../components/library/ReturnBookModal';
import ReservationPanel from '../components/library/ReservationPanel';
import FinesPanel from '../components/library/FinesPanel';

export default function Library() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [view, setView] = useState('grid');
  const [toast, setToast] = useState('');

  // Modals
  const [showAddBook, setShowAddBook] = useState(false);
  const [showIssue, setShowIssue] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [showReserve, setShowReserve] = useState(false);
  const [showFines, setShowFines] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);

  const { data: books = [], isLoading } = useBookList({});
  const { data: categories = [] } = useBookCategories();
  const { data: issues = [] } = useBookIssues({}, {});

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const filteredBooks = books.filter(b => {
    if (categoryFilter && b.category !== categoryFilter && b.category_name !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return b.title?.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q) || b.isbn?.includes(q);
    }
    return true;
  });

  const activeIssues = issues.filter(i => i.status === 'issued').length;
  const activeReservations = issues.filter(i => i.status === 'reserved').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl text-sm font-semibold bg-[#2D2A24] text-white shadow-[0_8px_32px_rgba(0,0,0,0.2)] animate-fade-in-up">
          {toast}
        </div>
      )}

      {selectedBook ? (
        // ── Book Detail Panel ──
        <div className="space-y-6">
          <button onClick={() => setSelectedBook(null)}
            className="flex items-center gap-2 text-sm font-semibold text-[#8A8680] hover:text-[#2D2A24] transition-colors cursor-pointer">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Catalog
          </button>

          <div className="bg-white rounded-[28px] border border-[#f1f5f9] shadow-[0_2px_8px_rgba(0,0,0,0.02)] p-8">
            <div className="flex flex-col sm:flex-row gap-8">
              {/* Cover */}
              <div className="w-full sm:w-48 aspect-[3/4] rounded-2xl bg-gradient-to-br from-[#2ED05D]/20 to-[#22C55E]/10 flex items-center justify-center shrink-0">
                {selectedBook.cover_url ? (
                  <img src={selectedBook.cover_url} alt={selectedBook.title} className="w-full h-full object-cover rounded-2xl" />
                ) : (
                  <svg className="w-16 h-16 text-[#2ED05D]/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                )}
              </div>

              {/* Info */}
              <div className="flex-1">
                <h2 className="text-2xl font-extrabold text-[#2D2A24]">{selectedBook.title}</h2>
                <p className="text-[#8A8680] font-medium mt-1">{selectedBook.author}</p>

                <div className="flex flex-wrap gap-2 mt-3">
                  {selectedBook.category_name && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-[8px] bg-blue-50 text-blue-700">{selectedBook.category_name}</span>
                  )}
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-[8px] ${
                    selectedBook.available_copies > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {selectedBook.available_copies > 0 ? `${selectedBook.available_copies} of ${selectedBook.total_copies} available` : 'Out of stock'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6">
                  {[
                    { label: 'ISBN', value: selectedBook.isbn || '—' },
                    { label: 'Publisher', value: selectedBook.publisher || '—' },
                    { label: 'Total Copies', value: selectedBook.total_copies || 0 },
                    { label: 'Available', value: selectedBook.available_copies || 0 },
                  ].map(f => (
                    <div key={f.label} className="bg-[#F7F9FC] rounded-2xl px-4 py-3">
                      <p className="text-xs font-semibold text-[#8A8680] uppercase tracking-wide">{f.label}</p>
                      <p className="text-sm font-bold text-[#2D2A24] mt-1">{f.value}</p>
                    </div>
                  ))}
                </div>

                {selectedBook.description && (
                  <p className="text-sm text-[#8A8680] mt-4 leading-relaxed">{selectedBook.description}</p>
                )}

                <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t border-[#f1f5f9]">
                  <button onClick={() => { setShowIssue(true); }}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[#2ED05D] text-white hover:bg-[#25B04E] transition-colors cursor-pointer"
                    disabled={selectedBook.available_copies < 1}>
                    Issue Book
                  </button>
                  <button onClick={() => { setShowReserve(true); }}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[#E8F9ED] text-[#25B04E] hover:bg-[#D1FAE5] transition-colors cursor-pointer">
                    Reserve
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="eyebrow">Resources</div>
              <h1 className="text-[2rem] sm:text-[2.5rem] font-extrabold text-[#2D2A24] tracking-tight leading-[1.1] -mt-1">Library</h1>
              <p className="text-[#8A8680] mt-2 font-medium text-sm">{books.length} books in catalog</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowIssue(true)}
                className="px-4 py-2.5 rounded-xl text-sm font-bold bg-[#2ED05D] text-white hover:bg-[#25B04E] transition-colors cursor-pointer">
                Issue
              </button>
              <button onClick={() => setShowReturn(true)}
                className="px-4 py-2.5 rounded-xl text-sm font-bold bg-[#E8F9ED] text-[#25B04E] hover:bg-[#D1FAE5] transition-colors cursor-pointer">
                Return
              </button>
              <button onClick={() => setShowReserve(true)}
                className="px-4 py-2.5 rounded-xl text-sm font-bold bg-[#FFF7ED] text-[#C2410C] hover:bg-[#FFEDD5] transition-colors cursor-pointer">
                Reserve
              </button>
              <button onClick={() => setShowFines(true)}
                className="px-4 py-2.5 rounded-xl text-sm font-bold bg-[#FEF2F2] text-[#DC2626] hover:bg-[#FEE2E2] transition-colors cursor-pointer">
                Fines
              </button>
              <button onClick={() => { setShowAddBook(true); }}
                className="px-4 py-2.5 rounded-xl text-sm font-bold bg-[#2ED05D] text-white hover:bg-[#25B04E] transition-colors cursor-pointer">
                + Add Book
              </button>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total Books', value: books.length, color: 'bg-blue-50 text-blue-700 border-blue-200' },
              { label: 'Available', value: books.reduce((s, b) => s + (b.available_copies || 0), 0), color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
              { label: 'Issued', value: activeIssues, color: 'bg-amber-50 text-amber-700 border-amber-200' },
              { label: 'Reserved', value: activeReservations, color: 'bg-purple-50 text-purple-700 border-purple-200' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
                <p className="text-xs font-medium opacity-70 mb-1">{s.label}</p>
                <p className="text-2xl font-bold">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8680]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" placeholder="Search by title, author, or ISBN…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="input py-2.5 pl-9 pr-4 w-full text-sm font-medium text-[#2D2A24] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#e2e8f0] transition-[border-color,box-shadow] duration-200 placeholder:text-[#B0ABA4] focus:border-[#2ED05D]" />
            </div>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
              className="input py-2.5 px-3 text-sm font-medium bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#e2e8f0] min-w-[140px]">
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="flex rounded-lg overflow-hidden border border-gray-200">
              <button onClick={() => setView('grid')}
                className={`p-2 transition-colors ${view === 'grid' ? 'bg-[#2ED05D] text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zm6-6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zm0 8a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button onClick={() => setView('list')}
                className={`p-2 transition-colors ${view === 'list' ? 'bg-[#2ED05D] text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>

          {/* Books */}
          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <span className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-[var(--color-text-secondary)]">Loading books…</span>
            </div>
          ) : filteredBooks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-[28px] border border-[#f1f5f9]">
              <div className="w-[72px] h-[72px] rounded-[20px] bg-[#E8F9ED] flex items-center justify-center mb-5">
                <svg className="w-8 h-8 text-[#2ED05D]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-[#2D2A24] mb-1">No books found</h3>
              <p className="text-sm font-medium text-[#8A8680]">Try adjusting your search or add a new book.</p>
            </div>
          ) : view === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredBooks.map((book, i) => (
                <BookCard key={book.id} book={book} onClick={setSelectedBook} colorIdx={i} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-[28px] border border-[#f1f5f9] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#F7F9FC] border-b border-[#f1f5f9]">
                      <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">Title</th>
                      <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">Author</th>
                      <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">ISBN</th>
                      <th className="text-left px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">Category</th>
                      <th className="text-center px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">Available</th>
                      <th className="text-center px-5 py-3 font-semibold text-[#8A8680] text-xs uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9]">
                    {filteredBooks.map(book => (
                      <tr key={book.id} onClick={() => setSelectedBook(book)}
                        className="hover:bg-[#F7F9FC]/50 cursor-pointer transition-colors">
                        <td className="px-5 py-4 font-semibold text-[#2D2A24]">{book.title}</td>
                        <td className="px-5 py-4 text-[#8A8680]">{book.author || '—'}</td>
                        <td className="px-5 py-4 text-[#8A8680] font-mono text-xs">{book.isbn || '—'}</td>
                        <td className="px-5 py-4">
                          {book.category_name && (
                            <span className="text-xs font-semibold px-2 py-1 rounded-[6px] bg-blue-50 text-blue-700">{book.category_name}</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center text-[#8A8680]">{book.available_copies}/{book.total_copies}</td>
                        <td className="px-5 py-4 text-center">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                            book.available_copies > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {book.available_copies > 0 ? 'Available' : 'Out'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <BookFormModal show={showAddBook} onClose={() => setShowAddBook(false)} onSuccess={() => showToast('Book added!')} />
      <IssueBookModal show={showIssue} onClose={() => setShowIssue(false)} onSuccess={() => showToast('Book issued!')} book={selectedBook} />
      <ReturnBookModal show={showReturn} onClose={() => setShowReturn(false)} onSuccess={() => showToast('Book returned!')} />
      <ReservationPanel show={showReserve} onClose={() => setShowReserve(false)} book={selectedBook} />
      <FinesPanel show={showFines} onClose={() => setShowFines(false)} />
    </div>
  );
}
