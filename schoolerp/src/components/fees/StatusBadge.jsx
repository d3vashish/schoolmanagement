import { FEE_STATUS_STYLES } from '../../hooks/useFees';

export default function StatusBadge({ status }) {
  const s = FEE_STATUS_STYLES[status] || FEE_STATUS_STYLES.Unpaid;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${s.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}
