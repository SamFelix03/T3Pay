import { z } from "zod";
import { id, sha256Json } from "../../domain/ids";
import { Router, readJson } from "../../http/router";
import { asJson, nowIso } from "../shared";
import { writeAudit } from "../activity/service";
import { runAgentTask } from "../tasks/service";

const demoStartSchema = z.object({
  displayName: z.string().min(1).default("VaultPay Demo User"),
  cardBalanceCents: z.number().int().positive().default(100_000),
  stablecoinBalanceCents: z.number().int().positive().default(100_000)
});

export function registerDemoRoutes(router: Router): void {
  router.post("/api/demo/start", async ({ req, app }) => {
    const body = await readJson(req, demoStartSchema);
    const now = nowIso();
    const userId = id("usr");
    const vaultId = id("vlt");
    const cardId = id("card");
    const walletId = id("wal");
    const agentId = id("agt");
    const appAgentId = id("appagt");
    const mandateId = id("mnd");
    if (!app.env.did) throw new Error("DID is required to start the demo flow");
    const agentIdentity = await app.t3n.createAgentIdentity(appAgentId);

    await app.repo.insert("users", { id: userId, did: app.env.did, display_name: body.displayName, created_at: now });
    await app.repo.insert("vaults", { id: vaultId, user_id: userId, status: "active", created_at: now });
    await app.repo.insert("payment_methods", {
      id: cardId,
      vault_id: vaultId,
      type: "card",
      alias: "VaultPay Demo Card",
      display: "VaultPay Demo Card ending 4242",
      balance_cents: body.cardBalanceCents,
      currency: "USD",
      status: "active",
      t3n_secret_ref: `z:tenant:secrets/${cardId}`,
      created_at: now
    });
    await app.repo.insert("payment_methods", {
      id: walletId,
      vault_id: vaultId,
      type: "stablecoin",
      alias: "VaultPay Demo USDC Wallet",
      display: "VaultPay Demo USDC Wallet address ...7c6a",
      balance_cents: body.stablecoinBalanceCents,
      currency: "USDC",
      status: "active",
      t3n_secret_ref: `z:tenant:secrets/${walletId}`,
      created_at: now
    });
    await app.repo.insert("agents", {
      id: agentId,
      user_id: userId,
      app_agent_id: appAgentId,
      t3n_did: agentIdentity.did,
      agent_did_source: agentIdentity.source,
      agent_public_key_b64u: agentIdentity.publicKeyB64u,
      name: "Shopping Agent",
      role: "shopping_agent",
      status: "active",
      payment_method: "both",
      created_at: now,
      updated_at: now
    });

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const t3nMandate = await app.t3n.createMandate({
      v: 1,
      id: mandateId,
      a: appAgentId,
      d: agentIdentity.did,
      b: 50_000,
      r: 50_000,
      l: 30_000,
      t: 15_000,
      x: Math.floor(new Date(expiresAt).getTime() / 1000),
      m: ["electronics-store", "grocery-market", "travel-booking"],
      c: ["electronics", "groceries", "travel"],
      p: ["card", "stablecoin"],
      s: "active"
    });
    const mandateHash = t3nMandate.h ?? sha256Json(t3nMandate);
    const grant = await app.t3n.createAgentGrant({
      appAgentId,
      agentDid: agentIdentity.did,
      role: "shopping_agent",
      mandateId,
      mandateHash,
      allowedMerchants: ["electronics-store", "grocery-market", "travel-booking"],
      allowedCategories: ["electronics", "groceries", "travel"],
      paymentMethods: ["card", "stablecoin"]
    });
    await app.repo.insert("mandates", {
      id: mandateId,
      user_id: userId,
      agent_id: agentId,
      status: "active",
      budget_cents: 50_000,
      budget_remaining_cents: 50_000,
      per_purchase_limit_cents: 30_000,
      approval_threshold_cents: 15_000,
      currency: "USD",
      expires_at: expiresAt,
      allowed_merchants_json: asJson(["electronics-store", "grocery-market", "travel-booking"]),
      allowed_categories_json: asJson(["electronics", "groceries", "travel"]),
      payment_methods_json: asJson(["both"]),
      cadence: "one_time",
      t3n_record_key: mandateId,
      mandate_hash: mandateHash,
      created_at: now,
      updated_at: now
    });

    await app.repo.insert("delegations", {
      id: id("dlg"),
      mandate_id: mandateId,
      agent_id: agentId,
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
      userId,
      agentId,
      type: "demo.started",
      entityType: "mandate",
      entityId: mandateId,
      payload: {
        mandateHash,
        didMode: "separate_t3n_agent_did",
        agentDid: agentIdentity.did,
        grant: { vcId: grant.vcId, functions: grant.functions, allowedHosts: grant.allowedHosts }
      }
    });

    const cardPurchase = await runAgentTask(app.repo, app.t3n, {
      agentId,
      mandateId,
      merchantId: "electronics-store",
      productId: "prd_charger",
      paymentMethodId: cardId,
      reason: "Demo: buy a USB-C charger under $50 using the card"
    });
    const stablecoinPurchase = await runAgentTask(app.repo, app.t3n, {
      agentId,
      mandateId,
      merchantId: "grocery-market",
      productId: "prd_pantry",
      paymentMethodId: walletId,
      reason: "Demo: buy groceries under $40 using the stablecoin wallet"
    });
    const approvalScenario = await runAgentTask(app.repo, app.t3n, {
      agentId,
      mandateId,
      merchantId: "travel-booking",
      productId: "prd_hotel",
      paymentMethodId: cardId,
      reason: "Demo: book travel that requires user approval"
    });

    return {
      user: { id: userId, did: app.env.did, displayName: body.displayName },
      vault: { id: vaultId },
      paymentMethods: { cardId, walletId },
      agent: { id: agentId, appAgentId, agentDid: agentIdentity.did },
      mandate: { id: mandateId, hash: t3nMandate.h },
      purchases: {
        card: cardPurchase,
        stablecoin: stablecoinPurchase,
        approvalScenario
      }
    };
  });
}
