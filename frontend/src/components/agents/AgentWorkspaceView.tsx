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
import { RunTracePanel } from "@/components/agents/RunTracePanel";
import { AgentChatPanel } from "@/components/agents/chat/AgentChatPanel";
import { CreditCard, Wallet } from "lucide-react";
import type { AppView } from "@/lib/types";

type Props = Pick<
  VaultPayApp,
  | "selectedAgent"
  | "agentMandate"
  | "agentActivity"
  | "agentRuns"
  | "busy"
  | "setView"
  | "runTrace"
  | "selectedRunId"
  | "loadRunTrace"
  | "paymentMethods"
  | "agentAllowedPaymentMethods"
  | "agentChat"
  | "chatDraft"
  | "setChatDraft"
  | "chatLoading"
  | "sendAgentChat"
  | "runFromChat"
>;

export function AgentWorkspaceView({
  selectedAgent,
  agentMandate,
  agentActivity,
  agentRuns,
  busy,
  setView,
  runTrace,
  selectedRunId,
  loadRunTrace,
  paymentMethods,
  agentAllowedPaymentMethods,
  agentChat,
  chatDraft,
  setChatDraft,
  chatLoading,
  sendAgentChat,
  runFromChat
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
  const agentRole = String(selectedAgent.role ?? "custom_agent");
  const budgetCents = Number(agentMandate?.budget_remaining_cents ?? 0);
  const paymentKinds = effectivePaymentMethodKinds(
    selectedAgent,
    paymentMethods.filter((method) => String(method.vault_id) === vaultId)
  );
  const canChat = Boolean(agentMandate && vaultId && agentAllowedPaymentMethods.length);

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

      <div className="agent-workspace-chat-layout">
        <AgentChatPanel
          agentName={String(selectedAgent.name)}
          agentRole={agentRole}
          roleLabel={roleLabel}
          vaultLabel={vaultLabel}
          grantStatus={grantStatus}
          chat={agentChat}
          draft={chatDraft}
          loading={chatLoading}
          busy={busy}
          canChat={canChat}
          onDraftChange={setChatDraft}
          onSend={sendAgentChat}
          onRun={runFromChat}
          onExample={setChatDraft}
        />

        <aside className="agent-workspace-side">
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
        </aside>
      </div>
    </div>
  );
}
