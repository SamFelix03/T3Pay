import { z } from "zod";
import { Router, readJson } from "../../http/router";
import { badRequest, conflict, forbidden } from "../../domain/errors";
import { nowIso } from "../shared";
import { writeAudit } from "../activity/service";
import { createSupabaseAdmin, requireAuthUser } from "../auth/supabase";
import { provisionDemoStarterKit } from "../vaults/provision";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().trim().min(1)
});

export function registerUserRoutes(router: Router): void {
  router.post("/api/users/register", async ({ req, app }) => {
    const body = await readJson(req, registerSchema);
    const admin = createSupabaseAdmin(app.env);
    const { data, error } = await admin.auth.admin.createUser({
      email: body.email.trim().toLowerCase(),
      password: body.password,
      email_confirm: true,
      user_metadata: { display_name: body.displayName.trim() }
    });
    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("already") || message.includes("registered")) {
        throw conflict("An account with this email already exists");
      }
      throw badRequest(error.message);
    }
    return { userId: data.user.id };
  });

  router.post("/api/users/sync", async ({ req, app }) => {
    const authUser = await requireAuthUser(req, app.env);
    const displayName =
      (typeof authUser.user_metadata?.display_name === "string" && authUser.user_metadata.display_name.trim()) ||
      authUser.email?.split("@")[0] ||
      "VaultPay User";
    const email = authUser.email ?? "";
    const did = app.env.did;
    if (!did) throw new Error("DID is required to sync a user");

    let user = await app.repo.maybeById<any>("users", authUser.id);
    if (!user) {
      const createdAt = nowIso();
      user = await app.repo.insert("users", {
        id: authUser.id,
        auth_user_id: authUser.id,
        email,
        did,
        display_name: displayName,
        created_at: createdAt
      });
      await writeAudit(app.repo, {
        userId: authUser.id,
        type: "user.sync_created",
        entityType: "user",
        entityId: authUser.id,
        payload: { email, authUserId: authUser.id }
      });
    } else if (email && user.email !== email) {
      user = await app.repo.update("users", authUser.id, { email, display_name: displayName });
    }

    const demoKit = await provisionDemoStarterKit(app.repo, authUser.id);
    return {
      user: {
        id: user.id,
        did: user.did,
        email: user.email ?? email,
        displayName: user.display_name ?? displayName
      },
      demoKit
    };
  });

  router.post("/api/users/:userId/ensure-demo-kit", async ({ req, params, app }) => {
    const authUser = await requireAuthUser(req, app.env);
    if (authUser.id !== params.userId) throw forbidden("user id does not match authenticated session");
    const user = await app.repo.maybeById<any>("users", params.userId);
    if (!user) throw conflict("user not synced");
    const demoKit = await provisionDemoStarterKit(app.repo, params.userId);
    return { demoKit };
  });
}
