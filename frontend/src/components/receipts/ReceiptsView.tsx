import type { AnyRow } from "@/lib/types";
import { short } from "@/lib/format";
import { EmptyState, FieldRow, StatusChip } from "@/components/ui/primitives";

type Props = {
  receipt: AnyRow | null;
  activity: AnyRow[];
  onVerify: (id: string) => void;
  busy: boolean;
};

export function ReceiptsView({ receipt, activity, onVerify, busy }: Props) {
  const purchaseEvents = activity.filter((event) =>
    ["approved", "rejected", "pending_approval", "revoked"].includes(String(event.decision ?? ""))
  );

  return (
    <div className="view-stack">
      {receipt ? (
        <section className="surface-card">
          <div className="card-head">
            <div>
              <span className="section-label">Selected receipt</span>
              <h2>{short(receipt.id)}</h2>
            </div>
            <StatusChip value={receipt.valid ? "verified" : String(receipt.receiptType ?? "stored")} />
          </div>
          <div className="insight-grid">
            <FieldRow label="Hash" value={short(receipt.receiptHash)} />
            <FieldRow label="Type" value={String(receipt.receiptType ?? "deterministic_hash")} />
          </div>
          <button type="button" className="ghost-btn" onClick={() => onVerify(String(receipt.id))} disabled={busy}>
            Verify
          </button>
        </section>
      ) : (
        <EmptyState text="Complete a purchase to view receipt proof." />
      )}

      {purchaseEvents.length ? (
        <section className="surface-card">
          <span className="section-label">Activity</span>
          <div className="data-table">
            {purchaseEvents.slice(0, 8).map((event) => (
              <div key={String(event.id)} className="data-row activity">
                <StatusChip value={String(event.decision ?? event.type)} />
                <span>{String(event.entity_type)}</span>
                <span>{short(event.hash)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
