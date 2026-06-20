import type { AnyRow } from "@/lib/types";
import { money, short } from "@/lib/format";
import { EmptyState } from "@/components/ui/primitives";

type Props = {
  approvals: AnyRow[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  busy: boolean;
};

export function ApprovalsView({ approvals, onApprove, onReject, busy }: Props) {
  if (!approvals.length) return <EmptyState text="No pending approvals." />;

  return (
    <div className="view-stack">
      {approvals.map((approval) => (
        <section key={String(approval.id)} className="surface-card">
          <div className="card-head">
            <div>
              <span className="section-label">Pending</span>
              <h2>{String(approval.reason ?? "Purchase request")}</h2>
            </div>
            <strong>{money(Number(approval.amount_cents ?? 0))}</strong>
          </div>
          <p className="muted-id">{short(approval.id)}</p>
          <div className="inline-actions">
            <button type="button" className="primary-btn" onClick={() => onApprove(String(approval.id))} disabled={busy}>Approve</button>
            <button type="button" className="ghost-btn" onClick={() => onReject(String(approval.id))} disabled={busy}>Reject</button>
          </div>
        </section>
      ))}
    </div>
  );
}
