"use client";

import type { VaultPayApp } from "@/hooks/useVaultPayApp";
import { getVaultLabel } from "@/lib/asset-previews";
import { money, short, timeAgo } from "@/lib/format";
import { FieldRow, StatusChip } from "@/components/ui/primitives";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { RunTracePanel } from "@/components/agents/RunTracePanel";

type Props = Pick<
  VaultPayApp,
  | "selectedAgent"
  | "agentMandate"
  | "agentActivity"
  | "agentRuns"
  | "candidates"
  | "paymentChoice"
  | "setPaymentChoice"
  | "runUseCase"
  | "onUseCaseChange"
  | "objective"
  | "setObjective"
  | "useCases"
  | "runSelectedAgent"
  | "busy"
  | "setView"
  | "runTrace"
  | "selectedRunId"
  | "loadRunTrace"
>;

export function AgentWorkspaceView({
  selectedAgent,
  agentMandate,
  agentActivity,
  agentRuns,
  candidates,
  paymentChoice,
  setPaymentChoice,
  runUseCase,
  onUseCaseChange,
  objective,
  setObjective,
  useCases,
  runSelectedAgent,
  busy,
  setView,
  runTrace,
  selectedRunId,
  loadRunTrace
}: Props) {
  if (!selectedAgent) {
    return (
      <section className="surface-card">
        <p className="empty-state">Select an agent from the dashboard.</p>
        <button type="button" className="ghost-btn" onClick={() => setView("dashboard")}>
          Back to dashboard
        </button>
      </section>
    );
  }

  const vaultId = selectedAgent.vault_id ? String(selectedAgent.vault_id) : null;

  return (
    <div className="view-stack">
      <section className="surface-card">
        <div className="card-head">
          <div>
            <button type="button" className="text-btn back-btn" onClick={() => setView("dashboard")}>
              ← Dashboard
            </button>
            <h2>{String(selectedAgent.name)}</h2>
            <p>{short(selectedAgent.t3n_did)}</p>
          </div>
          <StatusChip value={String(selectedAgent.status)} />
        </div>
        <div className="insight-grid three">
          <FieldRow label="Vault" value={vaultId ? getVaultLabel(vaultId) : "Not assigned"} />
          <FieldRow label="Budget left" value={money(Number(agentMandate?.budget_remaining_cents ?? 0))} />
          <FieldRow label="Grant" value={((selectedAgent.latestGrant as Record<string, unknown> | undefined)?.status as string) ?? "missing"} />
        </div>
      </section>

      <section className="surface-card agent-run-card">
        <div className="card-head">
          <div>
            <span className="section-label">Run workflow</span>
            <h2>Agent instruction</h2>
          </div>
        </div>

        <div className="composer-grid">
          <label>
            Category
            <SelectMenu
              value={runUseCase}
              options={useCases.map((item) => ({ value: item.id, label: item.label }))}
              onChange={(value) => onUseCaseChange(value as typeof runUseCase)}
            />
          </label>
          <label>
            Pay with
            <SelectMenu
              value={paymentChoice}
              options={[
                { value: "card", label: "Card" },
                { value: "stablecoin", label: "USDC" }
              ]}
              onChange={(value) => setPaymentChoice(value as typeof paymentChoice)}
            />
          </label>
          <label className="wide">
            Instruction
            <textarea value={objective} onChange={(event) => setObjective(event.target.value)} rows={3} />
          </label>
        </div>

        {candidates.length ? (
          <div className="candidate-row">
            {candidates.map((product) => (
              <span key={product.id}>
                {product.name} · {money(product.price_cents)}
              </span>
            ))}
          </div>
        ) : null}

        <div className="card-foot">
          <p>Runs authenticate as this agent&apos;s T3N DID, invoke policy on T3N, then settle mock balances.</p>
          <button
            type="button"
            className="primary-btn"
            onClick={runSelectedAgent}
            disabled={busy || !agentMandate || !vaultId}
          >
            Start agent
          </button>
        </div>
      </section>

      <RunTracePanel trace={runTrace} title="Latest run trace" />

      <section className="surface-card">
        <span className="section-label">Recent runs</span>
        {agentRuns.length ? (
          <div className="data-table">
            {agentRuns.map((run) => (
              <button
                key={String(run.id)}
                type="button"
                className={`data-row trace-run-row ${selectedRunId === String(run.id) ? "active" : ""}`}
                onClick={() => loadRunTrace(String(run.id))}
              >
                <span>{String(run.selected_product_id ?? "—")}</span>
                <span>{String(run.status)}</span>
                <span>{timeAgo(String(run.created_at))}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="empty-state">No runs yet for this agent.</p>
        )}
      </section>

      <section className="surface-card">
        <span className="section-label">Audit log</span>
        {agentActivity.length ? (
          <div className="data-table">
            {agentActivity.map((event) => (
              <div key={String(event.id)} className="data-row activity">
                <StatusChip value={String(event.event_type ?? event.type ?? "event")} />
                <span>{String(event.summary ?? event.message ?? event.action ?? "Activity")}</span>
                <span>{timeAgo(String(event.created_at))}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-state">Activity will appear here after runs and approvals.</p>
        )}
      </section>
    </div>
  );
}
