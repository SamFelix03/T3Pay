import { z } from "zod";
import { Router, readJson } from "../../http/router";
import { runAgentTask } from "./service";

const taskSchema = z.object({
  agentId: z.string().min(1),
  mandateId: z.string().min(1),
  merchantId: z.string().min(1),
  productId: z.string().min(1),
  paymentMethodId: z.string().min(1),
  reason: z.string().min(1)
});

export function registerTaskRoutes(router: Router): void {
  router.post("/api/agent-task", async ({ req, app }) => {
    const body = await readJson(req, taskSchema);
    return runAgentTask(app.repo, app.t3n, body);
  });
}
