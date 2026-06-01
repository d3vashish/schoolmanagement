import { useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useFrappeList, useFrappeCreate } from '../hooks/useFrappeQuery';

export default function Accounts() {
  const settings = useSettings();
  const [search, setSearch]     = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    account_name: '', parent_account: '', account_type: '',
    account_currency: 'INR', is_group: 0,
  });

  const { data: accounts = [], isLoading: loading } = useFrappeList(
    'Account',
    [['is_group', '=', 0]],
    ['name', 'account_name', 'parent_account', 'account_type', 'account_currency', 'balance'],
    300
  );

  const createMutation = useFrappeCreate('Account', {
    onSuccess: () => {
      setShowModal(false);
      setForm({ account_name: '', parent_account: '', account_type: '', account_currency: 'INR', is_group: 0 });
    },
  });

  const filtered = accounts.filter(a =>
    a.account_name?.toLowerCase().includes(search.toLowerCase()) ||
    a.parent_account?.toLowerCase().includes(search.toLowerCase()) ||
    a.account_type?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = (e) => {
    e.preventDefault();
    createMutation.mutate({ ...form, company: settings?.company || '' });
  };

  const typeColor = (type) => ({
    'Income Account': 'bg-green-100 text-green-700',
    'Expense Account': 'bg-red-100 text-red-700',
    'Asset': 'bg-blue-100 text-blue-700',
    'Liability': 'bg-orange-100 text-orange-700',
    'Equity': 'bg-purple-100 text-purple-700',
  }[type] || 'bg-gray-100 text-gray-600');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow">Finance</div>
          <h1 className="text-3xl font-bold text-[var(--color-text)] -mt-1">Accounts</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">Chart of accounts and financial ledger</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 group">
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center transition-all duration-300 group-hover:bg-white/30 group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </span>
          Add Account
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Accounts', value: accounts.length, icon: '🏦' },
          { label: 'Income', value: accounts.filter(a => a.account_type === 'Income Account').length, icon: '📈' },
          { label: 'Expenses', value: accounts.filter(a => a.account_type === 'Expense Account').length, icon: '📉' },
          { label: 'Assets', value: accounts.filter(a => a.account_type === 'Asset').length, icon: '🏛️' },
        ].map(s => (
          <div key={s.label} className="card text-center py-4">
            <p className="text-2xl mb-1">{s.icon}</p>
            <p className="text-2xl font-bold text-[var(--color-text)]">{s.value}</p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1 max-w-sm">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input placeholder="Search accounts…" value={search} onChange={e => setSearch(e.target.value)} className="input pl-11" />
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">{filtered.length} accounts</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Account Name', 'Parent', 'Type', 'Currency'].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="table-cell text-center py-12">
                  <span className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin inline-block" />
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="table-cell text-center py-12 text-[var(--color-text-secondary)]">
                  No accounts found.
                </td></tr>
              ) : filtered.map(acc => (
                <tr key={acc.name} className="hover:bg-gray-50">
                  <td className="table-cell font-medium">{acc.account_name || acc.name}</td>
                  <td className="table-cell text-[var(--color-text-secondary)] text-sm">{acc.parent_account || '—'}</td>
                  <td className="table-cell">
                    {acc.account_type && (
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${typeColor(acc.account_type)}`}>
                        {acc.account_type}
                      </span>
                    )}
                  </td>
                  <td className="table-cell">{acc.account_currency || 'INR'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-[var(--color-text)]">Add Account</h2>
              <button onClick={() => setShowModal(false)} className="group w-6 h-6 rounded-full bg-black/5 flex items-center justify-center group-hover:bg-black/10 transition-all duration-300">
                <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Account Name <span className="text-red-500">*</span></label>
                <input value={form.account_name} onChange={e => setForm(p => ({ ...p, account_name: e.target.value }))} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Account Type</label>
                <select value={form.account_type} onChange={e => setForm(p => ({ ...p, account_type: e.target.value }))} className="input">
                  <option value="">— Select Type —</option>
                  {['Income Account', 'Expense Account', 'Asset', 'Liability', 'Equity', 'Payable', 'Receivable'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Currency</label>
                <select value={form.account_currency} onChange={e => setForm(p => ({ ...p, account_currency: e.target.value }))} className="input">
                  <option value="INR">INR</option><option value="USD">USD</option><option value="EUR">EUR</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="btn-primary flex items-center gap-2 disabled:opacity-50 group">
                  {createMutation.isPending && <span className="w-4 h-4 flex items-center justify-center"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /></span>}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
