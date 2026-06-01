import { useState, useRef } from 'react';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_SIZE = 5 * 1024 * 1024;

export default function DocumentUpload({ onUpload, uploading = false }) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [docType, setDocType] = useState('Birth Certificate');
  const inputRef = useRef(null);

  const validate = (file) => {
    if (!ALLOWED_TYPES.includes(file.type)) { setError('Only PDF, JPG, or PNG files allowed'); return false; }
    if (file.size > MAX_SIZE) { setError('File size exceeds 5MB limit'); return false; }
    setError('');
    return true;
  };

  const handleFile = (file) => {
    if (!validate(file)) return;
    onUpload(file, docType);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200
          ${dragOver ? 'border-[#2ED05D] bg-[#E8F9ED]' : 'border-[#e2e8f0] bg-[#F7F9FC] hover:border-[#2ED05D] hover:bg-[#E8F9ED]/30'}`}>
        <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
          onChange={e => { const f = e.target.files[0]; if (f) handleFile(f); e.target.value = ''; }} />
        <svg className="w-10 h-10 mx-auto mb-3 text-[#2ED05D]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-sm font-semibold text-[#2D2A24]">Drop files here or click to upload</p>
        <p className="text-xs text-[#8A8680] mt-1">PDF, JPG, or PNG · Max 5MB</p>
      </div>

      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <select value={docType} onChange={e => setDocType(e.target.value)}
          className="input py-2 px-3 text-sm font-medium border border-[#e2e8f0] rounded-xl flex-1">
          <option>Birth Certificate</option>
          <option>Photograph</option>
          <option>Address Proof</option>
          <option>Previous Report Card</option>
          <option>Transfer Certificate</option>
          <option>Medical Certificate</option>
          <option>Other</option>
        </select>
        {uploading && <span className="w-5 h-5 border-2 border-[#2ED05D] border-t-transparent rounded-full animate-spin" />}
      </div>
    </div>
  );
}
