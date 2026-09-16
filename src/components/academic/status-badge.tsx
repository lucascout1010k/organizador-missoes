export function StatusBadge({ label, status }: { label: string; status: string }) {
  return <span className={`status status-${status}`}>{label}</span>;
}
