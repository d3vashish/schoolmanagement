import { useState, lazy, Suspense } from 'react';
import { useAcademicYear } from '../context/AcademicYearContext';

const FeesOverview = lazy(() => import('../components/fees/FeesOverview'));
const FeeStructures = lazy(() => import('../components/fees/FeeStructures'));
const FeeInvoices = lazy(() => import('../components/fees/FeeInvoices'));
const FeePayments = lazy(() => import('../components/fees/FeePayments'));
const FeeStudentView = lazy(() => import('../components/fees/FeeStudentView'));
const FeeConcessions = lazy(() => import('../components/fees/FeeConcessions'));
const FeeSchedules = lazy(() => import('../components/fees/FeeSchedules'));
const GenerateFeesModal = lazy(() => import('../components/fees/GenerateFeesModal'));

const TABS = [
  { key: 'overview',    label: 'Overview',    icon: '📊' },
  { key: 'structures',  label: 'Structures',  icon: '📋' },
  { key: 'invoices',    label: 'Invoices',    icon: '🧾' },
  { key: 'payments',    label: 'Payments',    icon: '💰' },
  { key: 'students',    label: 'Students',    icon: '👤' },
  { key: 'concessions', label: 'Concessions', icon: '🏷️' },
  { key: 'schedules',  label: 'Schedules',  icon: '📅' },
];

export default function Fees() {
  const { selectedYear } = useAcademicYear();
  const [activeTab, setActiveTab] = useState('overview');
  const [showGenerate, setShowGenerate] = useState(false);

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
          <button onClick={() => setShowGenerate(true)}
            className="flex items-center gap-2 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition group">
            <span className="w-4 h-4 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
            Generate Fees
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
        {activeTab === 'overview' && <FeesOverview onNavigate={handleNavigate} />}
        {activeTab === 'structures' && <FeeStructures />}
        {activeTab === 'invoices' && <FeeInvoices />}
        {activeTab === 'payments' && <FeePayments />}
        {activeTab === 'students' && <FeeStudentView />}
        {activeTab === 'concessions' && <FeeConcessions />}
        {activeTab === 'schedules' && <FeeSchedules />}
      </Suspense>

      {/* Generate Fees Modal */}
      {showGenerate && (
        <GenerateFeesModal
          onClose={() => setShowGenerate(false)}
          onGenerated={() => {
            setShowGenerate(false);
            setActiveTab('invoices');
          }}
        />
      )}
    </div>
  );
}
