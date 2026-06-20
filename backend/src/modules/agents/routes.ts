import { z } from "zod";
import { AGENT_STATUSES, PAYMENT_METHODS, ROLES } from "../../config/constants";
import { id } from "../../domain/ids";
import { Router, readJson } from "../../http/router";
import { nowIso } from "../shared";
import { writeAudit } from "../activity/service";

const createAgentSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1),
  role: z.enum(ROLES).default("shopping_agent"),
  paymentMethod: z.enum(PAYMENT_METHODS).default("both"),
  t3nDid: z.string().min(1).optional(),
  agentPublicKeyB64u: z.string().min(1).optional()
});

const updateRoleSchema = z.object({
  role: z.enum(ROLES),
  paymentMethod: z.enum(PAYMENT_METHODS).optional()
});

export function registerAgentRoutes(router: Router): void {
  router.get("/api/agents", ({ app, url }) => {
    const userId = url.searchParams.get("userId");
    return userId
      ? app.repo.list("agents", { eq: { user_id: userId }, order: { column: "created_at", ascending: false } }).then((agents) => ({ agents }))
      : app.repo.list("agents", { order: { column: "created_at", ascending: false } }).then((agents) => ({ agents }));
  });

  router.post("/api/agents", async ({ req, app }) => {
    const body = await readJson(req, createAgentSchema);
    await app.repo.getById("users", body.userId, "user");
    const agentId = id("agt");
    const appAgentId = id("appagt");
    const now = nowIso();
    const identity = body.t3nDid
      ? { did: body.t3nDid, source: "linked_external", publicKeyB64u: body.agentPublicKeyB64u ?? null }
      : await app.t3n.createAgentIdentity(appAgentId);
    const agent = await app.repo.insert("agents", {
      id: agentId,
      user_id: body.userId,
      app_agent_id: appAgentId,
      t3n_did: identity.did,
      agent_did_source: identity.source,
      agent_public_key_b64u: identity.publicKeyB64u,
      name: body.name,
      role: body.role,
      status: "active",
      payment_method: body.paymentMethod,
      created_at: now,
      updated_at: now
    });
    await writeAudit(app.repo, {
      userId: body.userId,
      agentId,
      type: "agent.created",
      entityType: "agent",
      entityId: agentId,
      payload: { appAgentId, role: body.role, agentDid: identity.did, source: identity.source }
    });
    return { agent };
  });

  router.get("/api/agents/:id/grants", async ({ params, app }) => {
    const grants = await app.repo.list("delegations", {
      eq: { agent_id: params.id },
      order: { column: "created_at", ascending: false }
    });
    return { grants: grants.map(decodeGrant) };
  });

  router.get("/api/agents/:id/audit", async ({ params, app }) => {
    const agent = await app.repo.getById<any>("agents", params.id, "agent");
    const proof = await app.t3n.getAgentProof(agent.t3n_did);
    return { agent: { id: agent.id, appAgentId: agent.app_agent_id, agentDid: agent.t3n_did }, proof };
  });

  router.patch("/api/agents/:id/role", async ({ req, params, app }) => {
    const body = await readJson(req, updateRoleSchema);
    const agent = await app.repo.getById<any>("agents", params.id, "agent");
    const updated = await app.repo.update("agents", params.id, {
      role: body.role,
      payment_method: body.paymentMethod ?? agent.payment_method,
      updated_at: nowIso()
    });
    await writeAudit(app.repo, { userId: agent.user_id, agentId: params.id, type: "agent.role_updated", entityType: "agent", entityId: params.id, payload: body });
    return { agent: updated };
  });

  for (const action of ["pause", "revoke"] as const) {
    router.post(`/api/agents/:id/${action}`, async ({ params, app }) => {
      const agent = await app.repo.getById<any>("agents", params.id, "agent");
      const status = action === "pause" ? "paused" : "revoked";
      const updated = await app.repo.update("agents", params.id, {
        status,
        updated_at: nowIso()
      });
      if (status === "revoked") {
        const activeDelegations = await app.repo.list<any>("delegations", { eq: { agent_id: params.id, status: "active" } });
        const revocations = [];
        for (const delegation of activeDelegations) {
          const revocation = await app.t3n.revokeAgentGrant({
            credentialJcsB64u: delegation.credential_jcs_b64u,
            revokedFunctions: parseJsonArray(delegation.functions_json)
          });
          revocations.push({ delegationId: delegation.id, revocation });
          await app.repo.update("delegations", delegation.id, {
            status: "revoked",
            t3n_revocation_result_json: JSON.stringify(revocation),
            revoked_at: nowIso()
          });
        }
        const mandates = await app.repo.list<any>("mandates", { eq: { agent_id: params.id } });
        for (const mandate of mandates.filter((row: any) => row.status === "active")) {
          await app.t3n.revokeMandate(mandate.t3n_record_key);
        }
        await app.repo.updateWhere("mandates", { agent_id: params.id }, { status: "revoked", updated_at: nowIso() });
        await writeAudit(app.repo, {
          userId: agent.user_id,
          agentId: params.id,
          type: "agent.grants_revoked",
          entityType: "agent",
          entityId: params.id,
          decision: "revoked",
          payload: { revocations }
        });
      }
      await writeAudit(app.repo, { userId: agent.user_id, agentId: params.id, type: `agent.${action}d`, entityType: "agent", entityId: params.id, decision: status, payload: { status } });
      return { agent: updated };
    });
  }
}

function decodeGrant(row: any) {
  return {
    ...row,
    functions: parseJsonArray(row.functions_json),
    allowedHosts: parseJsonArray(row.allowed_hosts_json),
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : null,
    t3nGrantResult: row.t3n_grant_result_json ? JSON.parse(row.t3n_grant_result_json) : null,
    t3nRevocationResult: row.t3n_revocation_result_json ? JSON.parse(row.t3n_revocation_result_json) : null
  };
}

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  const parsed = JSON.parse(value);
  return Array.isArray(parsed) ? parsed : [];
}
