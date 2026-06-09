import { useState } from 'react';
import { adminGetAuditLog } from '../api/frappe';
import { useQuery } from '@tanstack/react-query';
import Pagination from '../components/Pagination';

const ACTION_COLORS = {
  CREATE: 'text-green-700 bg-green-50',
  UPDATE: 'text-blue-700 bg-blue-50',
  DELETE: 'text-red-700 bg-red-50',
  LOGIN: 'text-purple-700 bg-purple-50',
  LOGOUT: 'text-gray-700 bg-gray-50',
};

export default function AuditLog() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const pageSize = 30;

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'audit', { page, page_size: pageSize, action_type: actionFilter || undefined }],
    queryFn: () => adminGetAuditLog({ page, page_size: pageSize, action_type: actionFilter || undefined }),
  });

  const logs = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <div className="eyebrow">Audit</div>
          <h1 className="text-[2rem] sm:text-[2.5rem] font-extrabold text-[#2D2A24] tracking-tight leading-[1.1] -mt-1">Audit Log</h1>
          <p className="text-[#8A8680] mt-2 font-medium text-sm">{total} total events</p>
        </div>
        <div className="relative">
          <select
            value={actionFilter}
            onChange={e => { setActionFilter(e.target.value); setPage(1); }}
            className="input py-2.5 pl-3 pr-8 w-44 text-sm font-medium text-[#2D2A24] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] border border-[#e2e8f0] appearance-none cursor-pointer"
          >
            <option value="">All Actions</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="LOGIN">LOGIN</option>
            <option value="LOGOUT">LOGOUT</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 rounded-2xl shimmer" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-[28px] border border-[#f1f5f9]">
          <div className="w-[72px] h-[72px] rounded-[20px] bg-[#F1F5F9] flex items-center justify-center mb-5">
            <svg className="w-8 h-8 text-[#8A8680]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-[#2D2A24] mb-1">No audit events found</h3>
        </div>
      ) : (
        <div className="bg-white rounded-[28px] border border-[#f1f5f9]/80 shadow-[0_2px_8px_rgba(0,0,0,0.02)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#f1f5f9]">
                  <th className="text-left px-6 py-4 font-bold text-[#8A8680] text-[11px] uppercase tracking-wider">Action</th>
                  <th className="text-left px-6 py-4 font-bold text-[#8A8680] text-[11px] uppercase tracking-wider">Table</th>
                  <th className="text-left px-6 py-4 font-bold text-[#8A8680] text-[11px] uppercase tracking-wider">Summary</th>
                  <th className="text-left px-6 py-4 font-bold text-[#8A8680] text-[11px] uppercase tracking-wider">Changed By</th>
                  <th className="text-left px-6 py-4 font-bold text-[#8A8680] text-[11px] uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-[#f1f5f9] hover:bg-[#fafbfc] transition-colors">
                    <td className="px-6 py-4">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-[8px] ${ACTION_COLORS[log.action] || 'text-gray-700 bg-gray-50'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-[#2D2A24]">{log.table_name}</td>
                    <td className="px-6 py-4 text-[#8A8680]">{log.summary || `${log.action} ${log.table_name}`}</td>
                    <td className="px-6 py-4 text-[#8A8680] font-mono text-xs">{log.changed_by ? log.changed_by.substring(0, 8) + '...' : '-'}</td>
                    <td className="px-6 py-4 text-[#8A8680] whitespace-nowrap">
                      {log.created_at ? new Date(log.created_at).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}
