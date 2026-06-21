import type { AnyRow } from "@/lib/types";
import type { VaultPayApp } from "@/hooks/useVaultPayApp";
import { getVaultLabel } from "@/lib/asset-previews";
import { money, short } from "@/lib/format";
import { VaultFundingBadges } from "@/components/vault/VaultFundingBadges";
import { EmptyState, FieldRow, MetricTile, StatusChip } from "@/components/ui/primitives";

type Props = Pick<
  VaultPayApp,
  | "dashboard"
  | "vaults"
  | "agents"
  | "paymentMethods"
  | "latestApproval"
  | "busy"
  | "setShowCreateVault"
  | "setShowCreateAgent"
  | "openAgentWorkspace"
  | "approveById"
  | "rejectLatest"
>;

export function DashboardView({
  dashboard,
  vaults,
  agents,
  paymentMethods,
  latestApproval,
  busy,
  setShowCreateVault,
  setShowCreateAgent,
  openAgentWorkspace,
  approveById,
  rejectLatest
}: Props) {
  const totals = dashboard?.totals;

  return (
    <div className="view-stack">
      <section className="metrics-row">
        <MetricTile label="Available balance" value={money(totals?.totalBalanceCents ?? 0)} accent />
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
          <button type="button" className="primary-btn" onClick={() => setShowCreateVault(true)}>
            Create your first vault
          </button>
        </section>
      ) : null}

      {!agents.length ? (
        <section className="alert-banner">
          <div>
            <strong>Create your first agent.</strong>
            <p>Agents get scoped ADK grants and spend from the vault you choose.</p>
          </div>
          <button
            type="button"
            className="primary-btn"
            onClick={() => setShowCreateAgent(true)}
            disabled={!vaults.length}
          >
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
            <button type="button" className="ghost-btn" onClick={() => setShowCreateVault(true)}>
              Add vault
            </button>
          ) : null}
        </div>
        {vaults.length ? (
          <div className="dashboard-vault-grid">
            {vaults.map((vault: AnyRow) => {
              const vaultId = String(vault.id);
              const methods = paymentMethods.filter((method) => String(method.vault_id) === vaultId);
              const card = methods.find((method) => method.type === "card");
              const wallet = methods.find((method) => method.type === "stablecoin");
              return (
                <article key={vaultId} className="dashboard-vault-card">
                  <div className="dashboard-vault-art" aria-hidden />
                  <div className="dashboard-vault-copy">
                    <strong>{getVaultLabel(vaultId)}</strong>
                    <span>{short(vaultId)}</span>
                    <VaultFundingBadges card={card} wallet={wallet} compact />
                  </div>
                </article>
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
            <button type="button" className="ghost-btn" onClick={() => setShowCreateAgent(true)} disabled={!vaults.length}>
              Add agent
            </button>
          ) : null}
        </div>
        {agents.length ? (
          <div className="agent-grid">
            {agents.map((agent: AnyRow) => (
              <button
                key={String(agent.id)}
                type="button"
                className="agent-card clickable"
                onClick={() => openAgentWorkspace(String(agent.id))}
              >
                <div className="agent-card-head">
                  <strong>{String(agent.name)}</strong>
                  <StatusChip value={String(agent.status)} />
                </div>
                <span>{short(agent.t3n_did)}</span>
                <span className="agent-card-cta">Open workspace →</span>
              </button>
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
