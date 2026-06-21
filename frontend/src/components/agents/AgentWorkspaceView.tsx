"use client";

import type { VaultPayApp } from "@/hooks/useVaultPayApp";
import { getVaultLabel } from "@/lib/asset-previews";
import {
  agentRoleLabel,
  effectivePaymentMethodKinds,
  grantStatusLabel,
  paymentMethodLabel
} from "@/lib/agent-utils";
import { money, timeAgo } from "@/lib/format";
import { StatusChip } from "@/components/ui/primitives";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { RunTracePanel } from "@/components/agents/RunTracePanel";
import { CreditCard, Wallet } from "lucide-react";
import type { AppView } from "@/lib/types";

type Props = Pick<
  VaultPayApp,
  | "selectedAgent"
  | "agentMandate"
  | "agentActivity"
  | "agentRuns"
  | "candidates"
  | "paymentChoice"
  | "setPaymentChoice"
  | "agentAllowedPaymentMethods"
  | "objective"
  | "setObjective"
  | "runSelectedAgent"
  | "busy"
  | "setView"
  | "runTrace"
  | "selectedRunId"
  | "loadRunTrace"
  | "paymentMethods"
>;

export function AgentWorkspaceView({
  selectedAgent,
  agentMandate,
  agentActivity,
  agentRuns,
  candidates,
  paymentChoice,
  setPaymentChoice,
  agentAllowedPaymentMethods,
  objective,
  setObjective,
  runSelectedAgent,
  busy,
  setView,
  runTrace,
  selectedRunId,
  loadRunTrace,
  paymentMethods
}: Props) {
  function navigate(view: AppView) {
    setView(view);
  }

  if (!selectedAgent) {
    return (
      <section className="surface-card">
        <p className="empty-state">Select an agent from the agents page.</p>
        <button type="button" className="ghost-btn" onClick={() => navigate("agents")}>
          Go to agents
        </button>
      </section>
    );
  }

  const vaultId = selectedAgent.vault_id ? String(selectedAgent.vault_id) : null;
  const vaultLabel = vaultId ? getVaultLabel(vaultId) : "Not assigned";
  const grantStatus = grantStatusLabel(selectedAgent);
  const roleLabel = agentRoleLabel(String(selectedAgent.role ?? "custom_agent"));
  const budgetCents = Number(agentMandate?.budget_remaining_cents ?? 0);
  const paymentKinds = effectivePaymentMethodKinds(
    selectedAgent,
    paymentMethods.filter((method) => String(method.vault_id) === vaultId)
  );
  const showPaymentPicker = agentAllowedPaymentMethods.length > 1;

  return (
    <div className="view-stack agent-workspace">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <button type="button" className="breadcrumb-link" onClick={() => navigate("agents")}>
          Agents
        </button>
        <span className="breadcrumb-sep" aria-hidden>
          /
        </span>
        <span className="breadcrumb-current">{String(selectedAgent.name)}</span>
      </nav>

      <section className="agent-workspace-hero surface-card">
        <div className="agent-workspace-hero-main">
          <div className="agent-workspace-title-row">
            <h1 className="agent-workspace-title">{String(selectedAgent.name)}</h1>
          </div>

          <div className="agent-workspace-payment-block">
            <span className="agent-workspace-payment-label">Available payment methods:</span>
            <div className="agent-workspace-badges">
              {paymentKinds.map((kind) => (
                <span key={kind} className={`agent-workspace-badge agent-workspace-badge--${kind}`}>
                  {kind === "card" ? (
                    <CreditCard className="agent-workspace-badge-icon" strokeWidth={1.75} aria-hidden />
                  ) : (
                    <Wallet className="agent-workspace-badge-icon" strokeWidth={1.75} aria-hidden />
                  )}
                  {paymentMethodLabel(kind)}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="agent-workspace-budget-badge">
          <span>Budget left</span>
          <strong>{money(budgetCents)}</strong>
        </div>
      </section>

      <section className="surface-card agent-run-card">
        <div className="agent-run-head">
          <span className="section-label">Run workflow</span>
          <h2 className="agent-run-title">Run Workflow</h2>
          <div className="agent-run-meta">
            <span className="agent-run-meta-item">
              <em>Role</em>
              {roleLabel}
            </span>
            <span className="agent-run-meta-item">
              <em>Vault</em>
              {vaultLabel}
            </span>
            <span className="agent-run-meta-item">
              <em>Status</em>
              <StatusChip value={grantStatus} />
            </span>
          </div>
        </div>

        <div className="agent-run-composer">
          {showPaymentPicker ? (
            <label className="agent-run-payment-field">
              <span>Pay with</span>
              <SelectMenu
                value={paymentChoice}
                options={agentAllowedPaymentMethods.map((kind) => ({
                  value: kind,
                  label: paymentMethodLabel(kind)
                }))}
                onChange={(value) => setPaymentChoice(value as typeof paymentChoice)}
              />
            </label>
          ) : null}

          <label className="agent-run-instruction">
            <span>Enter Your Instruction</span>
            <textarea value={objective} onChange={(event) => setObjective(event.target.value)} rows={4} />
          </label>

          {candidates.length ? (
            <div className="candidate-row agent-run-candidates">
              {candidates.map((product) => (
                <span key={product.id}>
                  {product.name} · {money(product.price_cents)}
                </span>
              ))}
            </div>
          ) : null}

          <div className="agent-run-actions">
            <button
              type="button"
              className="primary-btn"
              onClick={runSelectedAgent}
              disabled={busy || !agentMandate || !vaultId || !agentAllowedPaymentMethods.length}
            >
              Start agent
            </button>
          </div>
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
