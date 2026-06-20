import { z } from "zod";
import { PAYMENT_METHODS } from "../../config/constants";
import { id, sha256Json } from "../../domain/ids";
import { Router, readJson } from "../../http/router";
import { asJson, nowIso } from "../shared";
import { writeAudit } from "../activity/service";

const createMandateSchema = z.object({
  userId: z.string().min(1),
  agentId: z.string().min(1),
  budgetCents: z.number().int().positive(),
  perPurchaseLimitCents: z.number().int().positive(),
  approvalThresholdCents: z.number().int().nonnegative(),
  currency: z.enum(["USD", "USDC"]).default("USD"),
  expiresAt: z.string().datetime(),
  allowedMerchants: z.array(z.string().min(1)).min(1).max(8),
  allowedCategories: z.array(z.string().min(1)).min(1).max(8),
  paymentMethods: z.array(z.enum(PAYMENT_METHODS)).min(1),
  cadence: z.enum(["one_time", "recurring"]).default("one_time")
});

export function registerMandateRoutes(router: Router): void {
  router.get("/api/mandates/:id", async ({ params, app }) => {
    const mandate = await app.repo.getById<any>("mandates", params.id, "mandate");
    return { mandate: decodeMandate(mandate) };
  });

  router.post("/api/mandates", async ({ req, app }) => {
    const body = await readJson(req, createMandateSchema);
    const agent = await app.repo.getById<any>("agents", body.agentId, "agent");
    if (agent.user_id !== body.userId) throw new Error("agent does not belong to user");
    const mandateId = id("mnd");
    const t3nRecord = {
      v: 1 as const,
      id: mandateId,
      a: agent.app_agent_id,
      d: agent.t3n_did,
      b: body.budgetCents,
      r: body.budgetCents,
      l: body.perPurchaseLimitCents,
      t: body.approvalThresholdCents,
      x: Math.floor(new Date(body.expiresAt).getTime() / 1000),
      m: body.allowedMerchants,
      c: body.allowedCategories,
      p: expandPaymentMethods(body.paymentMethods),
      s: "active" as const
    };
    const createdRecord = await app.t3n.createMandate(t3nRecord);
    const mandateHash = createdRecord.h;
    if (!mandateHash) throw new Error("T3N mandate hash missing");
    const grant = await app.t3n.createAgentGrant({
      appAgentId: agent.app_agent_id,
      agentDid: agent.t3n_did,
      role: agent.role,
      mandateId,
      mandateHash,
      allowedMerchants: body.allowedMerchants,
      allowedCategories: body.allowedCategories,
      paymentMethods: body.paymentMethods
    });
    const now = nowIso();
    await app.repo.insert("mandates", {
        id: mandateId,
        user_id: body.userId,
        agent_id: body.agentId,
        status: "active",
        budget_cents: body.budgetCents,
        budget_remaining_cents: body.budgetCents,
        per_purchase_limit_cents: body.perPurchaseLimitCents,
        approval_threshold_cents: body.approvalThresholdCents,
        currency: body.currency,
        expires_at: body.expiresAt,
        allowed_merchants_json: asJson(body.allowedMerchants),
        allowed_categories_json: asJson(body.allowedCategories),
        payment_methods_json: asJson(body.paymentMethods),
        cadence: body.cadence,
        t3n_record_key: mandateId,
        mandate_hash: mandateHash,
        created_at: now,
        updated_at: now
    });
    const delegationId = id("dlg");
    await app.repo.insert("delegations", {
      id: delegationId,
      mandate_id: mandateId,
      agent_id: body.agentId,
      status: grant.status,
      grant_scope_hash: sha256Json({
        mandateId,
        agentDid: grant.agentDid,
        functions: grant.functions,
        allowedHosts: grant.allowedHosts,
        vcId: grant.vcId
      }),
      t3n_vc_id: grant.vcId,
      credential_jcs_b64u: grant.credentialJcsB64u,
      user_sig_b64u: grant.userSigB64u,
      agent_invocation_sig_b64u: grant.agentInvocationSigB64u,
      agent_nonce_b64u: grant.agentNonceB64u,
      request_hash_b64u: grant.requestHashB64u,
      agent_pubkey_b64u: grant.agentPubkeyB64u,
      user_did: grant.userDid,
      agent_did: grant.agentDid,
      contract_name: grant.contractName,
      contract_version: grant.contractVersion,
      functions_json: asJson(grant.functions),
      allowed_hosts_json: asJson(grant.allowedHosts),
      metadata_json: asJson(grant.metadata),
      t3n_grant_result_json: asJson(grant.t3nGrantResult),
      created_at: now
    });
    await writeAudit(app.repo, {
      userId: body.userId,
      agentId: body.agentId,
      type: "mandate.created",
      entityType: "mandate",
      entityId: mandateId,
      payload: {
        mandateHash,
        t3nRecord: createdRecord,
        grant: {
          id: delegationId,
          vcId: grant.vcId,
          agentDid: grant.agentDid,
          contractName: grant.contractName,
          functions: grant.functions,
          allowedHosts: grant.allowedHosts
        }
      }
    });
    return {
      mandate: decodeMandate(await app.repo.getById<any>("mandates", mandateId, "mandate")),
      delegation: {
        id: delegationId,
        status: grant.status,
        vcId: grant.vcId,
        agentDid: grant.agentDid,
        functions: grant.functions,
        allowedHosts: grant.allowedHosts
      }
    };
  });

  router.post("/api/mandates/:id/revoke", async ({ params, app }) => {
    const mandate = await app.repo.getById<any>("mandates", params.id, "mandate");
    const now = nowIso();
    const revokedRecord = await app.t3n.revokeMandate(mandate.t3n_record_key);
    const activeDelegations = await app.repo.list<any>("delegations", { eq: { mandate_id: params.id, status: "active" } });
    for (const delegation of activeDelegations) {
      const revocation = await app.t3n.revokeAgentGrant({
        credentialJcsB64u: delegation.credential_jcs_b64u,
        revokedFunctions: parseJsonArray(delegation.functions_json)
      });
      await app.repo.update("delegations", delegation.id, {
        status: "revoked",
        t3n_revocation_result_json: asJson(revocation),
        revoked_at: now
      });
    }
    await app.repo.update("mandates", params.id, { status: "revoked", updated_at: now });
    await app.repo.updateWhere("delegations", { mandate_id: params.id }, { status: "revoked", revoked_at: now });
    await writeAudit(app.repo, { userId: mandate.user_id, agentId: mandate.agent_id, type: "mandate.revoked", entityType: "mandate", entityId: params.id, decision: "revoked", payload: { mandateId: params.id, t3nRecord: revokedRecord } });
    return { mandate: decodeMandate(await app.repo.getById<any>("mandates", params.id, "mandate")) };
  });
}

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  const parsed = JSON.parse(value);
  return Array.isArray(parsed) ? parsed : [];
}

export function decodeMandate(row: any) {
  return {
    ...row,
    allowedMerchants: JSON.parse(row.allowed_merchants_json),
    allowedCategories: JSON.parse(row.allowed_categories_json),
    paymentMethods: JSON.parse(row.payment_methods_json)
  };
}

function expandPaymentMethods(methods: Array<"card" | "stablecoin" | "both">): Array<"card" | "stablecoin"> {
  const expanded = new Set<"card" | "stablecoin">();
  for (const method of methods) {
    if (method === "both") {
      expanded.add("card");
      expanded.add("stablecoin");
    } else {
      expanded.add(method);
    }
  }
  return [...expanded];
}
