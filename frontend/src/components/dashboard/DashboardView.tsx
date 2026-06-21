import type { AnyRow } from "@/lib/types";
import type { VaultPayApp } from "@/hooks/useVaultPayApp";
import { getVaultLabel } from "@/lib/asset-previews";
import { money, short } from "@/lib/format";
import { EmptyState, FieldRow, MetricTile, StatusChip } from "@/components/ui/primitives";

type Props = Pick<
  VaultPayApp,
  | "dashboard"
  | "vaults"
  | "agents"
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
  latestApproval,
  busy,
  setShowCreateVault,
  setShowCreateAgent,
  openAgentWorkspace,
  approveById,
  rejectLatest
}: Props) {
  return (
    <div className="view-stack">
      <section className="metrics-row">
        <MetricTile label="Delegated" value={money(dashboard?.totals.delegatedBudgetCents ?? 0)} accent />
        <MetricTile label="Approvals" value={String(dashboard?.totals.pendingApprovals ?? 0)} />
        <MetricTile label="Blocked" value={String(dashboard?.totals.blockedAttempts ?? 0)} />
        <MetricTile label="Agents" value={String(dashboard?.totals.activeAgents ?? 0)} />
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
          <div className="agent-grid">
            {vaults.map((vault: AnyRow) => (
              <article key={String(vault.id)} className="agent-card">
                <strong>{getVaultLabel(String(vault.id))}</strong>
                <span>{short(vault.id)}</span>
              </article>
            ))}
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
            <FieldRow label="Active agents" value={String(dashboard?.totals.activeAgents ?? 0)} />
            <FieldRow label="Vaults" value={String(vaults.length)} />
            <FieldRow label="Pending approvals" value={String(dashboard?.totals.pendingApprovals ?? 0)} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
