import { useState, useEffect } from 'react';
import { useCreateBook, useUpdateBook, useBookCategories, useCreateCategory } from '../../hooks/useLibrary';

export default function BookFormModal({ show, onClose, onSuccess, book = null }) {
  const isEdit = !!book;
  const [form, setForm] = useState({
    title: '', author: '', isbn: '', publisher: '', category: '', total_copies: 1, description: '',
  });
  const [newCategory, setNewCategory] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);

  const { data: categories = [] } = useBookCategories();
  const createMutation = useCreateBook({ onSuccess: () => { reset(); onClose?.(); onSuccess?.(); } });
  const updateMutation = useUpdateBook({ onSuccess: () => { onClose?.(); onSuccess?.(); } });
  const createCatMutation = useCreateCategory({ onSuccess: () => { setShowNewCat(false); setNewCategory(''); } });

  useEffect(() => {
    if (book) {
      setForm({
        title: book.title || '',
        author: book.author || '',
        isbn: book.isbn || '',
        publisher: book.publisher || '',
        category: book.category || '',
        total_copies: book.total_copies || 1,
        description: book.description || '',
      });
    } else {
      reset();
    }
  }, [book, show]);

  const reset = () => setForm({ title: '', author: '', isbn: '', publisher: '', category: '', total_copies: 1, description: '' });

  if (!show) return null;

  const isPending = createMutation.isPending || updateMutation.isPending;
  const handleSubmit = () => {
    if (isEdit) {
      updateMutation.mutate({ id: book.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-[#2D2A24]">{isEdit ? 'Edit Book' : 'Add Book'}</h3>
          <button onClick={onClose} className="p-2 text-[#8A8680] hover:text-[#2D2A24] transition-colors cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Title *</label>
              <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="input text-sm w-full" placeholder="Book title" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Author</label>
              <input type="text" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
                className="input text-sm w-full" placeholder="Author name" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">ISBN</label>
              <input type="text" value={form.isbn} onChange={e => setForm(f => ({ ...f, isbn: e.target.value }))}
                className="input text-sm w-full" placeholder="ISBN" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Publisher</label>
              <input type="text" value={form.publisher} onChange={e => setForm(f => ({ ...f, publisher: e.target.value }))}
                className="input text-sm w-full" placeholder="Publisher" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Total Copies</label>
              <input type="number" min="1" value={form.total_copies} onChange={e => setForm(f => ({ ...f, total_copies: e.target.value }))}
                className="input text-sm w-full" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Category</label>
              <div className="flex gap-2">
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="input text-sm flex-1">
                  <option value="">Select category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button onClick={() => setShowNewCat(!showNewCat)}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer">
                  +
                </button>
              </div>
              {showNewCat && (
                <div className="flex gap-2 mt-2">
                  <input type="text" value={newCategory} onChange={e => setNewCategory(e.target.value)}
                    className="input text-sm flex-1" placeholder="New category name" />
                  <button onClick={() => newCategory && createCatMutation.mutate({ name: newCategory })}
                    disabled={!newCategory || createCatMutation.isPending}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#2ED05D] text-white hover:bg-[#25B04E] transition-colors disabled:opacity-50 cursor-pointer">
                    Add
                  </button>
                </div>
              )}
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="input text-sm w-full min-h-[80px]" placeholder="Book description…" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#f1f5f9]">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={!form.title || isPending}
            className="btn-primary px-6 py-2.5 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed">
            {isPending ? 'Saving…' : isEdit ? 'Update Book' : 'Add Book'}
          </button>
        </div>
      </div>
    </div>
  );
}
