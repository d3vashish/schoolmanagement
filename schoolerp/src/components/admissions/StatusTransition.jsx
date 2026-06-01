import { useState } from 'react';
import { getAllowedTransitions } from '../../api/frappe';

export default function StatusTransition({ currentStatus, onTransition, loading = false }) {
  const [selected, setSelected] = useState('');
  const allowed = getAllowedTransitions(currentStatus);

  if (allowed.length === 0) return null;

  const handleTransition = () => {
    if (!selected) return;
    onTransition(selected);
    setSelected('');
  };

  return (
    <div className="flex items-center gap-3">
      <select value={selected} onChange={e => setSelected(e.target.value)}
        className="input py-2 px-3 text-sm font-medium border border-[#e2e8f0] rounded-xl min-w-[180px]">
        <option value="">Move to…</option>
        {allowed.map(s => (
          <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
        ))}
      </select>
      <button onClick={handleTransition} disabled={!selected || loading}
        className="px-4 py-2 rounded-xl text-sm font-bold bg-[#2ED05D] text-white hover:bg-[#25B04E] disabled:opacity-50 transition-colors cursor-pointer shrink-0">
        {loading ? '…' : 'Update'}
      </button>
    </div>
  );
}
