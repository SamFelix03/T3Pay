import type { AnyRow } from "@/lib/types";
import { short } from "@/lib/format";
import { EmptyState, FieldRow, StatusChip } from "@/components/ui/primitives";

function grantField(agent: AnyRow, key: string): string {
  const grant = agent.latestGrant as AnyRow | undefined;
  if (!grant?.[key]) return "—";
  return short(grant[key]);
}

type Props = {
  agents: AnyRow[];
  onRevoke: () => void;
  busy: boolean;
};

export function AgentsView({ agents, onRevoke, busy }: Props) {
  if (!agents.length) return <EmptyState text="No agents yet." />;

  return (
    <div className="view-stack">
      {agents.map((agent) => (
        <section key={String(agent.id)} className="surface-card">
          <div className="card-head">
            <div>
              <h2>{String(agent.name)}</h2>
              <p>{short(agent.t3n_did)}</p>
            </div>
            <StatusChip value={String(agent.status)} />
          </div>
          <div className="insight-grid three">
            <FieldRow label="App id" value={short(agent.app_agent_id)} />
            <FieldRow label="Grant" value={grantField(agent, "vcId")} />
            <FieldRow label="Contract" value={grantField(agent, "contractVersion")} />
          </div>
          <div className="card-foot">
            <p>{((agent.latestGrant as AnyRow | undefined)?.functions as string[] | undefined)?.join(", ") || "No scoped functions"}</p>
            {agent.status !== "revoked" ? (
              <button type="button" className="ghost-btn danger" onClick={onRevoke} disabled={busy}>Revoke</button>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  );
}
