#!/usr/bin/env node

const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

async function request(method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`${method} ${path} failed with ${response.status}: ${json.message ?? response.statusText}`);
    error.response = json;
    throw error;
  }
  return json;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function log(step, data = {}) {
  console.log(JSON.stringify({ step, ...data }));
}

const health = await request("GET", "/api/t3n/health");
assert(health.t3n?.configured === true, "T3N health endpoint did not return configured=true");
assert(health.t3n?.contractId, "T3N health endpoint did not expose a registered contract id");
log("health", {
  contractId: health.t3n.contractId,
  contractVersion: health.t3n.contractVersion,
  environment: health.t3n.environment
});

const demo = await request("POST", "/api/demo/start", {
  displayName: "VaultPay Production E2E",
  cardBalanceCents: 100000,
  stablecoinBalanceCents: 100000
});

assert(demo.user?.id, "demo did not create a user");
assert(demo.agent?.id && demo.agent?.agentDid, "demo did not create a T3N-backed agent");
assert(demo.mandate?.id && demo.mandate?.hash, "demo did not create a T3N-backed mandate");
assert(demo.purchases?.card?.attempt?.decision === "approved", "card purchase was not approved");
assert(demo.purchases?.stablecoin?.attempt?.decision === "approved", "stablecoin purchase was not approved");
assert(demo.purchases?.approvalScenario?.attempt?.decision === "pending_approval", "travel purchase did not require approval");
log("demo", {
  userId: demo.user.id,
  agentId: demo.agent.id,
  agentDid: demo.agent.agentDid,
  mandateId: demo.mandate.id,
  cardReceiptId: demo.purchases.card.receipt.id,
  stablecoinReceiptId: demo.purchases.stablecoin.receipt.id,
  approvalId: demo.purchases.approvalScenario.attempt.approvalId
});

const cardReceipt = await request("POST", `/api/receipts/${demo.purchases.card.receipt.id}/verify`);
const stablecoinReceipt = await request("POST", `/api/receipts/${demo.purchases.stablecoin.receipt.id}/verify`);
assert(cardReceipt.receipt?.valid === true, "card receipt did not verify");
assert(stablecoinReceipt.receipt?.valid === true, "stablecoin receipt did not verify");
log("receipts", {
  cardValid: cardReceipt.receipt.valid,
  stablecoinValid: stablecoinReceipt.receipt.valid
});

const approvalId = demo.purchases.approvalScenario.attempt.approvalId;
const approved = await request("POST", `/api/approvals/${approvalId}/approve`);
assert(approved.approval?.status === "approved", "approval status was not approved");
assert(approved.result?.attempt?.decision === "approved", "approved task did not resume into an approved purchase");
assert(approved.result?.receipt?.receiptHash, "approved task did not issue a receipt");
log("approval_resume", {
  approvalId,
  receiptId: approved.result.receipt.id,
  receiptHash: approved.result.receipt.receiptHash
});

const grants = await request("GET", `/api/agents/${demo.agent.id}/grants`);
assert(grants.grants?.some((grant) => grant.status === "active" && grant.agent_did === demo.agent.agentDid), "active agent grant not found");
log("grants", {
  active: grants.grants.filter((grant) => grant.status === "active").length,
  vcId: grants.grants[0]?.t3n_vc_id
});

const dashboard = await request("GET", `/api/dashboard?userId=${encodeURIComponent(demo.user.id)}`);
assert(dashboard.totals?.activeAgents >= 1, "dashboard did not show active agent");
assert(dashboard.agents?.[0]?.latestGrant?.status === "active", "dashboard did not expose latest active grant");
assert(dashboard.paymentMethods?.length >= 2, "dashboard did not expose both payment methods");
log("dashboard", {
  activeAgents: dashboard.totals.activeAgents,
  pendingApprovals: dashboard.totals.pendingApprovals,
  paymentMethods: dashboard.paymentMethods.length
});

const run = await request("POST", "/api/agent-runs", {
  agentId: demo.agent.id,
  mandateId: demo.mandate.id,
  paymentMethodId: demo.paymentMethods.cardId,
  objective: "Pick the best affordable electronics item for a developer desk setup",
  useCase: "electronics",
  candidateLimit: 3
});
assert(["approved", "pending_approval"].includes(run.run?.status), "Groq-backed agent run did not complete with a valid decision state");
assert(run.run?.rationale, "Groq-backed agent run did not store rationale");
log("agent_run", {
  runId: run.run.id,
  status: run.run.status,
  selectedProductId: run.run.selected_product_id,
  rationale: run.run.rationale
});

const audit = await request("GET", `/api/agents/${demo.agent.id}/audit`);
assert(audit.agent?.agentDid === demo.agent.agentDid, "agent audit proof did not target the expected agent DID");
log("agent_audit", {
  logs: audit.proof?.logs?.length ?? 0,
  auditEvents: audit.proof?.auditEvents?.length ?? 0
});

const revoked = await request("POST", `/api/agents/${demo.agent.id}/revoke`);
assert(revoked.agent?.status === "revoked", "agent was not revoked");
const blocked = await request("POST", "/api/agent-task", {
  agentId: demo.agent.id,
  mandateId: demo.mandate.id,
  merchantId: "electronics-store",
  productId: "prd_charger",
  paymentMethodId: demo.paymentMethods.cardId,
  reason: "This should be blocked after revocation"
});
assert(blocked.attempt?.decision === "revoked", "revoked agent was still able to run");
log("revocation", {
  agentStatus: revoked.agent.status,
  blockedDecision: blocked.attempt.decision,
  blockedReason: blocked.attempt.reason
});

log("complete");
