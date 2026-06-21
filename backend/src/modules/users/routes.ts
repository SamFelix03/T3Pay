import { z } from "zod";
import { Router, readJson } from "../../http/router";
import { id } from "../../domain/ids";
import { notFound } from "../../domain/errors";
import { nowIso } from "../shared";
import { writeAudit } from "../activity/service";
import { provisionDemoStarterKit } from "../vaults/provision";

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
    const demoKit = await provisionDemoStarterKit(app.repo, userId);
    return {
      user: { id: userId, did, displayName: body.displayName, createdAt },
      demoKit
    };
  });

  router.post("/api/users/:userId/ensure-demo-kit", async ({ params, app }) => {
    const user = await app.repo.maybeById<any>("users", params.userId);
    if (!user) throw notFound("user");
    const demoKit = await provisionDemoStarterKit(app.repo, params.userId);
    return { demoKit };
  });
}
