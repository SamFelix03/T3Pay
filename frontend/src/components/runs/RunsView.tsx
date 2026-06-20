import type { AnyRow } from "@/lib/types";
import { EmptyState, StatusChip } from "@/components/ui/primitives";

type Props = {
  runs: AnyRow[];
};

export function RunsView({ runs }: Props) {
  if (!runs.length) return <EmptyState text="No agent runs yet. Start one from the dashboard." />;

  return (
    <div className="view-stack">
      {runs.map((run) => (
        <section key={String(run.id)} className="surface-card">
          <div className="card-head">
            <div>
              <span className="section-label">{String(run.use_case ?? "run")}</span>
              <h2>{String(run.objective)}</h2>
            </div>
            <StatusChip value={String(run.status)} />
          </div>
          <p className="run-rationale">{String(run.rationale)}</p>
          <div className="run-meta">
            <span>{String(run.model)}</span>
            <span>{run.selected_product_id ? String(run.selected_product_id) : "—"}</span>
            <span>{Math.round(Number(run.confidence ?? 0) * 100)}%</span>
          </div>
        </section>
      ))}

      <section className="surface-card memory-note">
        <span className="section-label">Agent memory</span>
        <p>Visible: product, merchant, price, order ID, receipt ID.</p>
        <p>Never visible: card number, CVC, wallet key, billing data.</p>
      </section>
    </div>
  );
}
