"use client";

import type { AnyRow, Product, RunTrace } from "@/lib/types";
import { getVaultLabel } from "@/lib/asset-previews";
import { agentRoleLabel } from "@/lib/agent-utils";
import { humanizePurchaseReason, purchaseOutcomeMessage } from "@/lib/purchase-outcome";
import { money } from "@/lib/format";
import { formatRunDate, productLabel, runShortId } from "@/lib/run-utils";
import { StatusChip, FieldRow } from "@/components/ui/primitives";
import { RunTracePanel } from "@/components/agents/RunTracePanel";

type Props = {
  run: AnyRow | null;
  runId: string | null;
  trace: RunTrace | null;
  agents: AnyRow[];
  products: Product[];
  onBack: () => void;
  onOpenAgent: (agentId: string) => void;
};

export function RunDetailView({
  run,
  runId,
  trace,
  agents,
  products,
  onBack,
  onOpenAgent
}: Props) {
  if (!runId) {
    return (
      <section className="surface-card">
        <p className="empty-state">Select a run from the runs table.</p>
        <button type="button" className="ghost-btn" onClick={onBack}>
          Back to runs
        </button>
      </section>
    );
  }

  if (!run) {
    return <p className="empty-state">Loading run details…</p>;
  }

  const agent = agents.find((item) => String(item.id) === String(run.agent_id));
  const agentName = agent ? String(agent.name) : String(run.agent_id ?? "—");
  const agentRole = agent ? agentRoleLabel(String(agent.role ?? "custom_agent")) : "—";
  const vaultLabel = agent?.vault_id ? getVaultLabel(String(agent.vault_id)) : "—";
  const productId = String(run.selected_product_id ?? "");
  const productName = productLabel(productId, products);
  const catalogProduct = products.find((product) => product.id === productId);
  const candidateProducts = (run.candidateProducts as AnyRow[] | undefined) ?? [];
  const status = String(run.status ?? "unknown");
  const purchaseAttempt = run.purchase_attempt as AnyRow | undefined;
  const decisionReason = String(run.decision_reason ?? purchaseAttempt?.reason ?? "");
  const outcomeMessage = purchaseOutcomeMessage({
    status,
    reason: decisionReason,
    productName,
    priceCents: catalogProduct?.price_cents
  });
  const showOutcomeBanner = status !== "approved";

  return (
    <div className="view-stack run-detail">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <button type="button" className="breadcrumb-link" onClick={onBack}>
          Runs
        </button>
        <span className="breadcrumb-sep" aria-hidden>
          /
        </span>
        <span className="breadcrumb-current">{productName}</span>
      </nav>

      <section className="run-detail-hero surface-card">
        <div className="run-detail-hero-main">
          <span className="section-label">Agent run</span>
          <h1 className="run-detail-title">{productName}</h1>
          <p className="run-detail-subtitle">{String(run.objective ?? "—")}</p>
          <div className="run-detail-meta-row">
            <span className="run-detail-meta-pill">{String(run.use_case ?? "—")}</span>
            <span className="run-detail-meta-pill">{String(run.model ?? "—")}</span>
            <span className="run-detail-meta-pill">{Math.round(Number(run.confidence ?? 0) * 100)}% confidence</span>
          </div>
        </div>
        <StatusChip value={status} />
      </section>

      {showOutcomeBanner ? (
        <section className={`run-detail-outcome surface-card run-detail-outcome--${status.replace(/_/g, "-")}`}>
          <span className="section-label">Policy outcome</span>
          <p className="run-detail-outcome-message">{outcomeMessage}</p>
        </section>
      ) : null}

      <section className="run-detail-stats surface-card">
        <div className="metric-grid">
          <article className="metric-tile">
            <span>Agent</span>
            <strong>{agentName}</strong>
          </article>
          <article className="metric-tile">
            <span>Role</span>
            <strong>{agentRole}</strong>
          </article>
          <article className="metric-tile">
            <span>Vault</span>
            <strong>{vaultLabel}</strong>
          </article>
          <article className="metric-tile">
            <span>Merchant</span>
            <strong>{String(run.selected_merchant_id ?? "—").replace(/-/g, " ")}</strong>
          </article>
          <article className="metric-tile">
            <span>Price</span>
            <strong>{catalogProduct ? money(catalogProduct.price_cents) : "—"}</strong>
          </article>
          <article className="metric-tile">
            <span>Run ID</span>
            <strong className="run-detail-mono">{runShortId(String(run.id))}</strong>
          </article>
        </div>
      </section>

      <div className="run-detail-grid">
        <section className="surface-card">
          <span className="section-label">Selection rationale</span>
          <p className="run-detail-rationale">{String(run.rationale ?? "No rationale recorded.")}</p>
        </section>

        <section className="surface-card">
          <span className="section-label">Identifiers</span>
          <div className="field-stack">
            <FieldRow label="Purchase attempt" value={String(run.purchase_attempt_id ?? "—")} />
            <FieldRow label="Receipt" value={String(run.receipt_id ?? "—")} />
            <FieldRow label="Mandate" value={String(run.mandate_id ?? "—")} />
            <FieldRow label="Created" value={formatRunDate(String(run.created_at))} />
          </div>
        </section>
      </div>

      {candidateProducts.length ? (
        <section className="run-detail-candidates">
          <span className="section-label">Candidate products</span>
          <div className="vp-table-card">
            <div className="vp-table-scroll">
              <table className="vp-table vp-table--compact">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Merchant</th>
                    <th>Selected</th>
                  </tr>
                </thead>
                <tbody>
                  {candidateProducts.map((candidate) => {
                    const id = String(candidate.id ?? "");
                    const selected = id === productId;
                    const merchant =
                      String(candidate.merchantName ?? candidate.merchant_name ?? candidate.merchantId ?? "—").replace(
                        /-/g,
                        " "
                      );
                    return (
                      <tr key={id} className={selected ? "vp-table-row vp-table-row--active" : "vp-table-row"}>
                        <td className="vp-table-primary">{String(candidate.name ?? productLabel(id, products))}</td>
                        <td className="vp-table-muted">{merchant}</td>
                        <td>{selected ? <StatusChip value="Selected" /> : null}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      <section className="run-detail-trace-shell">
        <RunTracePanel trace={trace} title="Execution trace" fillHeight />
      </section>

      {agent ? (
        <div className="run-detail-actions">
          <button type="button" className="primary-btn" onClick={() => onOpenAgent(String(agent.id))}>
            Open agent workspace
          </button>
        </div>
      ) : null}
    </div>
  );
}
