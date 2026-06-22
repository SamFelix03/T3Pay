import { z } from "zod";
import { Router, readJson } from "../../http/router";
import { handleAgentChat } from "./service";

const chatSchema = z.object({
  agentId: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000)
      })
    )
    .min(1)
    .max(24)
});

export function registerAgentChatRoutes(router: Router): void {
  router.post("/api/agent-chat", async ({ req, app }) => {
    const body = await readJson(req, chatSchema);
    return handleAgentChat(app.repo, app.env, body);
  });
}
