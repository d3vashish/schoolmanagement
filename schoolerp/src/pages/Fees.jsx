import { useState, lazy, Suspense } from 'react';
import { useAcademicYear } from '../context/AcademicYearContext';


const FeeStructures = lazy(() => import('../components/fees/FeeStructures'));
const FeeStudentView = lazy(() => import('../components/fees/FeeStudentView'));
const CollectionReport = lazy(() => import('../components/fees/CollectionReport'));
const RecordPaymentModal = lazy(() => import('../components/fees/RecordPaymentModal'));
const FeesDashboard = lazy(() => import('../components/fees/FeesDashboard'));

const TABS = [
  { key: 'dashboard',   label: 'Dashboard',   icon: '🏫' },
  { key: 'structures',  label: 'Structures',  icon: '📋' },
  { key: 'students',    label: 'Students',    icon: '👤' },
  { key: 'collections', label: 'Collections', icon: '📈' },
];

export default function Fees() {
  const { selectedYear } = useAcademicYear();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showRecordPayment, setShowRecordPayment] = useState(false);

  const handleNavigate = (tab) => setActiveTab(tab);

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Fees</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            Manage student fees, structures, payments, and collections.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowRecordPayment(true)}
            className="flex items-center gap-2 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition group">
            <span className="w-4 h-4 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </span>
            Record Payment
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.key
                ? 'bg-white text-[var(--color-primary)] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}>
            <span className="text-base">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center py-28 gap-3">
          <div className="w-10 h-10 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--color-text-secondary)]">Loading...</p>
        </div>
      }>
        {activeTab === 'dashboard' && <FeesDashboard onNavigate={handleNavigate} />}
        {activeTab === 'structures' && <FeeStructures />}
        {activeTab === 'students' && <FeeStudentView />}
        {activeTab === 'collections' && <CollectionReport />}
      </Suspense>

      {/* Record Payment Modal */}
      {showRecordPayment && (
        <RecordPaymentModal onClose={() => setShowRecordPayment(false)} />
      )}
    </div>
  );
}