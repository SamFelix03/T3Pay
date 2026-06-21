"use client";

import type { AnyRow } from "@/lib/types";
import { grantStatusLabel, mandateForAgent, paymentMethodKinds } from "@/lib/agent-utils";
import { money, short } from "@/lib/format";
import { StatusChip } from "@/components/ui/primitives";
import { CreditCard, Wallet } from "lucide-react";

type Props = {
  agent: AnyRow;
  mandates: AnyRow[];
  onRun: (agentId: string) => void;
  onRevoke: (agentId: string) => void;
  busy: boolean;
};

export function AgentGridCard({ agent, mandates, onRun, onRevoke, busy }: Props) {
  const agentId = String(agent.id);
  const mandate = mandateForAgent(mandates, agentId);
  const budgetCents = Number(mandate?.budget_remaining_cents ?? 0);
  const grantStatus = grantStatusLabel(agent);
  const methods = paymentMethodKinds(agent);
  const canRevoke = String(agent.status) !== "revoked";

  function handleCardClick() {
    if (busy) return;
    onRun(agentId);
  }

  function handleCardKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (busy) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onRun(agentId);
    }
  }

  return (
    <article
      className="agent-grid-card agent-grid-card--clickable"
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      role="button"
      tabIndex={busy ? -1 : 0}
      aria-label={`Open ${String(agent.name)} workspace`}
    >
      <div className="agent-grid-card-brand">
        <strong className="agent-grid-card-name">{String(agent.name)}</strong>
      </div>

      <code className="agent-grid-card-did">{short(agent.t3n_did)}</code>

      <div className="agent-grid-card-badges">
        {methods.map((kind) => (
          <span key={kind} className={`agent-payment-badge ${kind}`} title={kind === "card" ? "Card" : "USDC wallet"}>
            {kind === "card" ? (
              <CreditCard className="agent-payment-badge-icon" strokeWidth={1.75} aria-hidden />
            ) : (
              <Wallet className="agent-payment-badge-icon" strokeWidth={1.75} aria-hidden />
            )}
          </span>
        ))}
        <StatusChip value={grantStatus} />
      </div>

      <div className="agent-grid-card-budget">
        <span>Budget left</span>
        <strong>{money(budgetCents)}</strong>
      </div>

      <footer className="agent-grid-card-actions">
        {canRevoke ? (
          <button
            type="button"
            className="ghost-btn danger agent-revoke-btn"
            onClick={(event) => {
              event.stopPropagation();
              onRevoke(agentId);
            }}
            disabled={busy}
          >
            Revoke
          </button>
        ) : (
          <span className="agent-grid-card-spacer" />
        )}
        <button
          type="button"
          className="primary-btn agent-run-btn"
          onClick={(event) => {
            event.stopPropagation();
            onRun(agentId);
          }}
          disabled={busy}
        >
          Run
        </button>
      </footer>
    </article>
  );
}
