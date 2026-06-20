import { z } from "zod";
import { Router, readJson } from "../../http/router";
import { id } from "../../domain/ids";
import { nowIso } from "../shared";
import { writeAudit } from "../activity/service";

const sessionSchema = z.object({
  displayName: z.string().min(1).default("VaultPay User"),
  did: z.string().min(1).optional()
});

export function registerUserRoutes(router: Router): void {
  router.post("/api/users/session", async ({ req, app }) => {
    const body = await readJson(req, sessionSchema);
    const userId = id("usr");
    const did = body.did ?? app.env.did;
    if (!did) throw new Error("DID is required to create a session");
    const createdAt = nowIso();
    await app.repo.insert("users", { id: userId, did, display_name: body.displayName, created_at: createdAt });
    await writeAudit(app.repo, {
      userId,
      type: "user.session_created",
      entityType: "user",
      entityId: userId,
      payload: { userId, didMode: "t3n_user_did_with_separate_agent_dids" }
    });
    return { user: { id: userId, did, displayName: body.displayName, createdAt } };
  });
}
