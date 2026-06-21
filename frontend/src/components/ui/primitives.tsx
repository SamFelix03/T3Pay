export function StatusChip({ value }: { value: string }) {
  const normalized = String(value ?? "unknown").toLowerCase().replace(/\s+/g, "_");
  return <span className={`status-chip ${normalized}`}>{value}</span>;
}

export function EmptyState({ text }: { text: string }) {
  return <p className="empty-state">{text}</p>;
}

export function MetricTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <article className={`metric-tile ${accent ? "accent" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="field-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
