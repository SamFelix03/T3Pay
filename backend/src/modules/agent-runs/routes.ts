import { z } from "zod";
import { Router, readJson } from "../../http/router";
import { executeAgentRun, decodeRun } from "./run-flow";

const runSchema = z.object({
  agentId: z.string().min(1),
  mandateId: z.string().min(1),
  paymentMethodId: z.string().min(1),
  objective: z.string().min(1),
  useCase: z.enum(["electronics", "groceries", "travel"]),
  candidateLimit: z.number().int().min(2).max(3).default(3)
});

export function registerAgentRunRoutes(router: Router): void {
  router.get("/api/agent-runs", async ({ app, url }) => {
    const agentId = url.searchParams.get("agentId");
    const userId = url.searchParams.get("userId");

    if (agentId) {
      const runs = await app.repo.list<any>("agent_runs", {
        eq: { agent_id: agentId },
        order: { column: "created_at", ascending: false }
      });
      return { runs: runs.map(decodeRun) };
    }

    if (userId) {
      const agents = await app.repo.list<any>("agents", { eq: { user_id: userId } });
      const agentIds = agents.map((agent: any) => agent.id);
      if (!agentIds.length) return { runs: [] };
      const runs = await app.repo.list<any>("agent_runs", {
        in: { agent_id: agentIds },
        order: { column: "created_at", ascending: false },
        limit: 100
      });
      return { runs: runs.map(decodeRun) };
    }

    return { runs: [] };
  });

  router.get("/api/agent-runs/:id", async ({ params, app }) => {
    const run = await app.repo.getById("agent_runs", params.id, "agent run");
    return { run: decodeRun(run) };
  });

  router.post("/api/agent-runs", async ({ req, app }) => {
    const body = await readJson(req, runSchema);
    return executeAgentRun(app.repo, app.t3n, app.env, body);
  });
}
