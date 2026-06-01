import { useState } from 'react';

export default function CircularModal({ show, onClose, onSubmit }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetClass, setTargetClass] = useState('All');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [isPublished, setIsPublished] = useState(false);

  if (!show) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    onSubmit({ title: title.trim(), body: body.trim(), target_class: targetClass, attachment_url: attachmentUrl, is_published: isPublished });
    setTitle(''); setBody(''); setTargetClass('All'); setAttachmentUrl(''); setIsPublished(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-[28px] p-6 w-full max-w-lg shadow-[0_16px_48px_rgba(0,0,0,0.1)]" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-extrabold text-[#2D2A24] mb-2">Create Circular</h3>
        <p className="text-sm font-medium text-[#8A8680] mb-5">Send an announcement to students, parents, or staff.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#8A8680] uppercase tracking-wide mb-1 block">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required
              className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl focus:border-[#2ED05D]" placeholder="Circular title" />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#8A8680] uppercase tracking-wide mb-1 block">Body</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} required rows={5}
              className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl focus:border-[#2ED05D] resize-none" placeholder="Circular content…" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-[#8A8680] uppercase tracking-wide mb-1 block">Target Class</label>
              <select value={targetClass} onChange={e => setTargetClass(e.target.value)}
                className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl focus:border-[#2ED05D]">
                <option value="All">All Classes</option>
                <option value="Class 1">Class 1</option>
                <option value="Class 2">Class 2</option>
                <option value="Class 3">Class 3</option>
                <option value="Class 4">Class 4</option>
                <option value="Class 5">Class 5</option>
                <option value="Class 6">Class 6</option>
                <option value="Class 7">Class 7</option>
                <option value="Class 8">Class 8</option>
                <option value="Class 9">Class 9</option>
                <option value="Class 10">Class 10</option>
                <option value="Staff">Staff Only</option>
                <option value="Parents">Parents Only</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[#8A8680] uppercase tracking-wide mb-1 block">Attachment URL</label>
              <input value={attachmentUrl} onChange={e => setAttachmentUrl(e.target.value)}
                className="input py-2.5 px-4 w-full text-sm font-medium border border-[#e2e8f0] rounded-xl focus:border-[#2ED05D]" placeholder="https://..." />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setIsPublished(p => !p)}
              className={`w-11 h-6 rounded-full transition-colors relative ${isPublished ? 'bg-[#2ED05D]' : 'bg-gray-200'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isPublished ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm font-semibold text-[#2D2A24]">Publish immediately</span>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-bold bg-gray-100 text-[#475569] hover:bg-gray-200 transition-colors cursor-pointer">Cancel</button>
            <button type="submit"
              className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[#2ED05D] text-white hover:bg-[#25B04E] transition-colors cursor-pointer">Create Circular</button>
          </div>
        </form>
      </div>
    </div>
  );
}
