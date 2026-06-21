import type { AnyRow } from "@/lib/types";
import type { VaultPayApp } from "@/hooks/useVaultPayApp";
import { sumPaymentBalances } from "@/lib/agent-utils";
import { getVaultLabel } from "@/lib/asset-previews";
import { fundingForVault } from "@/lib/vault-funding";
import { money } from "@/lib/format";
import { AgentGridCard } from "@/components/agents/AgentGridCard";
import { VaultGridCard } from "@/components/vault/VaultGridCard";
import { EmptyState, FieldRow, MetricTile } from "@/components/ui/primitives";

type Props = Pick<
  VaultPayApp,
  | "dashboard"
  | "vaults"
  | "agents"
  | "paymentMethods"
  | "latestApproval"
  | "busy"
  | "setShowCreateAgent"
  | "openAgentWorkspace"
  | "revokeAgent"
  | "approveById"
  | "rejectLatest"
> & {
  onViewAllVaults: () => void;
  onViewAllAgents: () => void;
};

export function DashboardView({
  dashboard,
  vaults,
  agents,
  paymentMethods,
  latestApproval,
  busy,
  setShowCreateAgent,
  openAgentWorkspace,
  revokeAgent,
  approveById,
  rejectLatest,
  onViewAllVaults,
  onViewAllAgents
}: Props) {
  const totals = dashboard?.totals;
  const mandates = dashboard?.mandates ?? [];
  const availableBalanceCents = sumPaymentBalances(paymentMethods);

  return (
    <div className="view-stack">
      <section className="metrics-row">
        <MetricTile label="Available balance" value={money(availableBalanceCents)} accent />
        <MetricTile label="Vaults" value={String(totals?.vaultCount ?? vaults.length)} />
        <MetricTile label="Pending approvals" value={String(totals?.pendingApprovals ?? 0)} />
        <MetricTile label="Active agents" value={String(totals?.activeAgents ?? 0)} />
      </section>

      {!vaults.length ? (
        <section className="alert-banner">
          <div>
            <strong>You haven&apos;t created any vaults yet.</strong>
            <p>Seal a card and wallet together, then bind agents to the vault they should spend from.</p>
          </div>
          <button type="button" className="primary-btn" onClick={onViewAllVaults}>
            Go to vaults
          </button>
        </section>
      ) : null}

      {!agents.length ? (
        <section className="alert-banner">
          <div>
            <strong>Create your first agent.</strong>
            <p>Agents get scoped ADK grants and spend from the vault you choose.</p>
          </div>
          <button type="button" className="primary-btn" onClick={() => setShowCreateAgent(true)} disabled={!vaults.length}>
            Create agent
          </button>
        </section>
      ) : null}

      {latestApproval ? (
        <section className="surface-card approval-banner">
          <div>
            <span className="section-label">Needs approval</span>
            <strong>{String(latestApproval.reason ?? "Purchase request")}</strong>
          </div>
          <div className="inline-actions">
            <button type="button" className="primary-btn" onClick={() => approveById(String(latestApproval.id))} disabled={busy}>
              Approve
            </button>
            <button type="button" className="ghost-btn" onClick={() => rejectLatest()} disabled={busy}>
              Reject
            </button>
          </div>
        </section>
      ) : null}

      <section className="surface-card">
        <div className="card-head">
          <div>
            <span className="section-label">Vaults</span>
            <h2>{vaults.length ? `${vaults.length} vault${vaults.length === 1 ? "" : "s"}` : "No vaults"}</h2>
          </div>
          {vaults.length ? (
            <button type="button" className="ghost-btn" onClick={onViewAllVaults}>
              View all vaults
            </button>
          ) : null}
        </div>
        {vaults.length ? (
          <div className="vault-grid vault-grid--compact">
            {vaults.map((vault: AnyRow) => {
              const vaultId = String(vault.id);
              const funding = fundingForVault(paymentMethods, vaultId);
              return (
                <VaultGridCard
                  key={vaultId}
                  vaultId={vaultId}
                  label={getVaultLabel(vaultId)}
                  card={funding.card}
                  wallet={funding.wallet}
                />
              );
            })}
          </div>
        ) : (
          <EmptyState text="Vaults hold the cards and wallets your agents can spend from." />
        )}
      </section>

      <section className="surface-card">
        <div className="card-head">
          <div>
            <span className="section-label">Agents</span>
            <h2>{agents.length ? `${agents.length} agent${agents.length === 1 ? "" : "s"}` : "No agents yet"}</h2>
          </div>
          {agents.length ? (
            <button type="button" className="ghost-btn" onClick={onViewAllAgents}>
              View all agents
            </button>
          ) : null}
        </div>
        {agents.length ? (
          <div className="agent-page-grid agent-page-grid--compact">
            {agents.map((agent: AnyRow) => (
              <AgentGridCard
                key={String(agent.id)}
                agent={agent}
                mandates={mandates}
                onRun={openAgentWorkspace}
                onRevoke={revokeAgent}
                busy={busy}
              />
            ))}
          </div>
        ) : (
          <EmptyState text="Create an agent to run purchases and view audit logs in its workspace." />
        )}
      </section>

      {agents.length ? (
        <section className="surface-card compact-insight">
          <span className="section-label">Quick snapshot</span>
          <div className="insight-grid">
            <FieldRow label="Agent budget remaining" value={money(totals?.delegatedBudgetCents ?? 0)} />
            <FieldRow label="Completed runs" value={String(totals?.completedRuns ?? 0)} />
            <FieldRow label="Policy denials" value={String(totals?.blockedAttempts ?? 0)} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
