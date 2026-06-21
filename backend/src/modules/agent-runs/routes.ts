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
  router.get("/api/agent-runs", ({ app, url }) => {
    const agentId = url.searchParams.get("agentId");
    return (agentId
      ? app.repo.list("agent_runs", { eq: { agent_id: agentId }, order: { column: "created_at", ascending: false } })
      : app.repo.list("agent_runs", { order: { column: "created_at", ascending: false }, limit: 100 })
    ).then((runs) => ({ runs: runs.map(decodeRun) }));
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
