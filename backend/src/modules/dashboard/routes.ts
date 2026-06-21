import { Router } from "../../http/router";

export function registerDashboardRoutes(router: Router): void {
  router.get("/api/dashboard", async ({ app, url }) => {
    const userId = url.searchParams.get("userId");
    const agentOptions = userId ? { eq: { user_id: userId }, order: { column: "created_at", ascending: false } } : { order: { column: "created_at", ascending: false } };
    const mandateOptions = userId ? { eq: { user_id: userId }, order: { column: "created_at", ascending: false } } : { order: { column: "created_at", ascending: false } };
    const [rawAgents, mandates, allPendingApprovals, rawActivity, allRuns] = await Promise.all([
      app.repo.list<any>("agents", agentOptions),
      app.repo.list<any>("mandates", mandateOptions),
      app.repo.list<any>("approvals", { eq: { status: "pending" }, order: { column: "created_at", ascending: false } }),
      app.repo.list<any>("audit_events", { order: { column: "created_at", ascending: false }, limit: 20 }),
      app.repo.list<any>("agent_runs", { order: { column: "created_at", ascending: false }, limit: 10 })
    ]);
    const rawDelegations = rawAgents.length
      ? await app.repo.list<any>("delegations", {
          in: { agent_id: rawAgents.map((agent: any) => agent.id) },
          order: { column: "created_at", ascending: false }
        })
      : [];
    const latestGrantByAgent = new Map<string, any>();
    for (const grant of rawDelegations) {
      if (!latestGrantByAgent.has(grant.agent_id)) latestGrantByAgent.set(grant.agent_id, decodeGrant(grant));
    }
    const agents = rawAgents.map((agent: any) => ({
      ...agent,
      latestGrant: latestGrantByAgent.get(agent.id) ?? null
    }));
    const agentIds = new Set(agents.map((agent: any) => agent.id));
    const approvals = userId ? allPendingApprovals.filter((approval: any) => agentIds.has(approval.agent_id)) : allPendingApprovals;
    const recentActivity = userId
      ? rawActivity.filter((event: any) => event.user_id === userId || agentIds.has(event.agent_id))
      : rawActivity;
    const rawRuns = userId ? allRuns.filter((run: any) => agentIds.has(run.agent_id)) : allRuns;
    const paymentMethods = userId
      ? await paymentMethodsForUser(app, userId)
      : await app.repo.list<any>("payment_methods", { select: "id,vault_id,type,alias,display,balance_cents,currency,status,created_at", order: { column: "created_at", ascending: false } });
    const recentRuns = rawRuns.map((run: any) => ({
      ...run,
      candidateProducts: JSON.parse(run.candidate_products_json),
      trace: run.trace_json ? JSON.parse(run.trace_json) : null
    }));
    const blockedAttempts = agents.length > 0
      ? await app.repo.count("purchase_attempts", {
          in: {
            decision: ["rejected", "revoked", "expired"],
            agent_id: [...agentIds]
          }
        })
      : 0;
    const completedRuns = agents.length > 0
      ? await app.repo.count("agent_runs", { in: { agent_id: [...agentIds] } })
      : 0;
    const totalBalanceCents = paymentMethods.reduce(
      (sum: number, method: any) => sum + Number(method.balance_cents ?? 0),
      0
    );
    const vaults = userId
      ? await app.repo.list<any>("vaults", { eq: { user_id: userId }, order: { column: "created_at", ascending: false } })
      : [];
    const totals = {
      activeAgents: agents.filter((agent: any) => agent.status === "active").length,
      delegatedBudgetCents: mandates.reduce((sum: number, mandate: any) => sum + mandate.budget_remaining_cents, 0),
      pendingApprovals: approvals.length,
      blockedAttempts,
      totalBalanceCents,
      vaultCount: vaults.length,
      completedRuns
    };
    return { totals, vaults, agents, mandates, paymentMethods, approvals, recentRuns, recentActivity };
  });
}

function decodeGrant(row: any) {
  return {
    id: row.id,
    status: row.status,
    vcId: row.t3n_vc_id,
    agentDid: row.agent_did,
    contractName: row.contract_name,
    contractVersion: row.contract_version,
    functions: parseJsonArray(row.functions_json),
    allowedHosts: parseJsonArray(row.allowed_hosts_json),
    revokedAt: row.revoked_at
  };
}

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  const parsed = JSON.parse(value);
  return Array.isArray(parsed) ? parsed : [];
}

async function paymentMethodsForUser(app: any, userId: string) {
  const vaults = await app.repo.list("vaults", { eq: { user_id: userId } });
  if (vaults.length === 0) return [];
  return app.repo.list("payment_methods", {
    in: { vault_id: vaults.map((vault: any) => vault.id) },
    select: "id,vault_id,type,alias,display,balance_cents,currency,status,created_at",
    order: { column: "created_at", ascending: false }
  });
}
