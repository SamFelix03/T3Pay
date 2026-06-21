"use client";

import type { AnyRow } from "@/lib/types";
import { AgentGridCard } from "@/components/agents/AgentGridCard";
import { EmptyState } from "@/components/ui/primitives";
import { Plus } from "lucide-react";

type Props = {
  agents: AnyRow[];
  mandates: AnyRow[];
  onRun: (agentId: string) => void;
  onRevoke: (agentId: string) => void;
  onCreate?: () => void;
  busy: boolean;
};

export function AgentsView({ agents, mandates, onRun, onRevoke, onCreate, busy }: Props) {
  if (!agents.length && !onCreate) return <EmptyState text="No agents yet." />;

  return (
    <div className="agent-page-grid">
      {agents.map((agent) => (
        <AgentGridCard
          key={String(agent.id)}
          agent={agent}
          mandates={mandates}
          onRun={onRun}
          onRevoke={onRevoke}
          busy={busy}
        />
      ))}

      {onCreate ? (
        <button type="button" className="agent-grid-card agent-grid-card--create" onClick={onCreate}>
          <Plus className="agent-create-icon" strokeWidth={1.75} aria-hidden />
          <strong>Create agent</strong>
          <span>Bind an agent to a vault with scoped spending policy.</span>
        </button>
      ) : null}

      {!agents.length ? <EmptyState text="No agents yet. Create one to start running purchases." /> : null}
    </div>
  );
}
