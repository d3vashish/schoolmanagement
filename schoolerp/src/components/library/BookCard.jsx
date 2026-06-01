const PLACEHOLDER_COLORS = [
  'from-[#2ED05D]/20 to-[#22C55E]/10',
  'from-[#6C8EBF]/20 to-[#4A6FA5]/10',
  'from-[#B877D9]/20 to-[#9A5FC4]/10',
  'from-[#F06A6A]/20 to-[#D94A4A]/10',
  'from-[#E8A060]/20 to-[#D08848]/10',
  'from-[#A08CD6]/20 to-[#826DC4]/10',
];

const CATEGORY_COLORS = {
  default: 'bg-gray-100 text-gray-700',
  fiction: 'bg-blue-50 text-blue-700',
  non_fiction: 'bg-emerald-50 text-emerald-700',
  reference: 'bg-purple-50 text-purple-700',
  textbook: 'bg-amber-50 text-amber-700',
  magazine: 'bg-rose-50 text-rose-700',
};

const categoryColor = (cat) => {
  const key = (cat || '').toLowerCase().replace(/\s+/g, '_');
  return CATEGORY_COLORS[key] || CATEGORY_COLORS.default;
};

export default function BookCard({ book, onClick, colorIdx = 0 }) {
  const colors = PLACEHOLDER_COLORS[colorIdx % PLACEHOLDER_COLORS.length];

  return (
    <div onClick={() => onClick?.(book)}
      className="group relative bg-white rounded-[28px] p-5 border border-[#f1f5f9]/80 shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-[border-color,transform,box-shadow] duration-200 hover:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.06)] hover:border-[#BBF7D0] cursor-pointer flex flex-col active:scale-[0.98]">
      
      {/* Cover placeholder */}
      <div className={`w-full aspect-[3/4] rounded-2xl bg-gradient-to-br ${colors} flex items-center justify-center mb-4 overflow-hidden`}>
        {book.cover_url ? (
          <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
        ) : (
          <div className="text-center p-3">
            <svg className="w-10 h-10 mx-auto mb-2 text-[#2ED05D]/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <p className="text-[10px] font-bold text-[#2ED05D]/40 uppercase tracking-wider">{book.category_name || 'Book'}</p>
          </div>
        )}
      </div>

      {/* Info */}
      <h3 className="font-extrabold text-[#2D2A24] text-sm leading-tight truncate mb-1">{book.title}</h3>
      <p className="text-xs font-medium text-[#8A8680] truncate mb-3">{book.author || 'Unknown Author'}</p>

      {/* Category badge + availability */}
      <div className="flex items-center justify-between mt-auto">
        {book.category_name && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-[6px] ${categoryColor(book.category_name)}`}>
            {book.category_name}
          </span>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className={`w-2 h-2 rounded-full ${book.available_copies > 0 ? 'bg-emerald-500' : 'bg-red-400'}`} />
          <span className={`text-[10px] font-bold ${book.available_copies > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {book.available_copies > 0 ? `${book.available_copies} available` : 'Out'}
          </span>
        </div>
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 rounded-[28px] ring-1 ring-inset ring-transparent group-hover:ring-[#BBF7D0] transition-all duration-200 pointer-events-none" />
    </div>
  );
}
