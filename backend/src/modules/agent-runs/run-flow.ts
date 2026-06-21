import type { Env } from "../../config/env";
import { conflict } from "../../domain/errors";
import type { SupabaseRepository } from "../../db/supabase";
import { id } from "../../domain/ids";
import { asJson, nowIso } from "../shared";
import { writeAudit } from "../activity/service";
import type { VaultpayT3nGateway } from "../t3n/gateway";
import { chooseProductWithGroq, type CandidateProduct } from "./groq";
import { RunTrace } from "./trace";
import { runAgentTask, type AgentTaskInput } from "../tasks/service";

export type AgentRunInput = {
  agentId: string;
  mandateId: string;
  paymentMethodId: string;
  objective: string;
  useCase: "electronics" | "groceries" | "travel";
  candidateLimit: number;
};

export async function executeAgentRun(
  repo: SupabaseRepository,
  t3n: VaultpayT3nGateway,
  env: Env,
  body: AgentRunInput
) {
  const trace = new RunTrace();
  trace.step("run", "Agent run started", {
    agentId: body.agentId,
    mandateId: body.mandateId,
    paymentMethodId: body.paymentMethodId,
    objective: body.objective,
    useCase: body.useCase
  });

  const agent = await repo.getById<any>("agents", body.agentId, "agent");
  const user = await repo.getById<any>("users", agent.user_id, "user");
  const mandate = await repo.getById<any>("mandates", body.mandateId, "mandate");
  if (mandate.agent_id !== body.agentId) throw conflict("mandate does not belong to agent");

  trace.step("agent", "Loaded agent identity", {
    agentId: agent.id,
    name: agent.name,
    appAgentId: agent.app_agent_id,
    agentDid: agent.t3n_did,
    role: agent.role,
    status: agent.status,
    vaultId: agent.vault_id ?? null,
    paymentMethodScope: agent.payment_method
  });

  const paymentMethod = await repo.getById<any>("payment_methods", body.paymentMethodId, "payment method");
  if (!agent.vault_id) {
    trace.error("vault", "Agent has no assigned vault", {});
    throw conflict("agent has no assigned vault");
  }
  if (String(paymentMethod.vault_id) !== String(agent.vault_id)) {
    trace.error("vault", "Payment method is outside the agent vault", {
      agentVaultId: agent.vault_id,
      paymentMethodVaultId: paymentMethod.vault_id,
      paymentMethodId: paymentMethod.id,
      paymentMethodType: paymentMethod.type,
      paymentMethodDisplay: paymentMethod.display
    });
    throw conflict("payment method does not belong to agent vault");
  }
  trace.success("vault", "Payment method belongs to assigned vault", {
    vaultId: agent.vault_id,
    paymentMethodId: paymentMethod.id,
    paymentMethodType: paymentMethod.type,
    paymentMethodDisplay: paymentMethod.display,
    balanceCents: paymentMethod.balance_cents,
    credentialExposure: "none — only alias/display sent to agent context"
  });

  const delegation = await repo.list<any>("delegations", {
    eq: { agent_id: body.agentId, mandate_id: body.mandateId, status: "active" },
    order: { column: "created_at", ascending: false },
    limit: 1
  });
  const activeDelegation = delegation[0] ?? null;
  trace.step(
    "delegation",
    activeDelegation ? "Active ADK delegation loaded" : "No active delegation found",
    activeDelegation
      ? {
          delegationId: activeDelegation.id,
          vcId: activeDelegation.t3n_vc_id,
          contractName: activeDelegation.contract_name,
          contractVersion: activeDelegation.contract_version,
          functions: activeDelegation.functions_json ? JSON.parse(activeDelegation.functions_json) : [],
          allowedHosts: activeDelegation.allowed_hosts_json ? JSON.parse(activeDelegation.allowed_hosts_json) : [],
          agentDid: activeDelegation.agent_did,
          userDid: activeDelegation.user_did
        }
      : {},
    activeDelegation ? "success" : "error"
  );

  trace.step("auth", "Authenticating agent T3N DID", {
    appAgentId: agent.app_agent_id,
    expectedDid: agent.t3n_did
  });
  const agentAuth = await t3n.authenticateAgent(agent.app_agent_id, agent.t3n_did);
  trace.success("auth", "Agent authenticated on T3N", {
    agentDid: agentAuth.did,
    address: agentAuth.address,
    publicKeyB64u: agentAuth.publicKeyB64u
  });

  const allowedCategories = JSON.parse(mandate.allowed_categories_json);
  const allowedMerchants = JSON.parse(mandate.allowed_merchants_json);
  trace.step("mandate", "Loaded spending mandate", {
    mandateId: mandate.id,
    t3nRecordKey: mandate.t3n_record_key,
    budgetRemainingCents: mandate.budget_remaining_cents,
    perPurchaseLimitCents: mandate.per_purchase_limit_cents,
    approvalThresholdCents: mandate.approval_threshold_cents,
    allowedCategories,
    allowedMerchants,
    paymentMethods: JSON.parse(mandate.payment_methods_json)
  });

  const [rawProducts, merchants] = await Promise.all([
    repo.list<any>("products", { eq: { category: body.useCase }, order: { column: "price_cents", ascending: true }, limit: body.candidateLimit }),
    repo.list<any>("merchants")
  ]);
  const merchantById = new Map(merchants.map((merchant: any) => [merchant.id, merchant]));
  const products = rawProducts.filter(
    (product: any) =>
      product.price_cents <= mandate.budget_remaining_cents &&
      allowedCategories.includes(product.category) &&
      allowedMerchants.includes(product.merchant_id)
  );

  const candidates: CandidateProduct[] = products.map((product: any) => ({
    id: product.id,
    merchantId: product.merchant_id,
    merchantName: merchantById.get(product.merchant_id)?.name ?? product.merchant_id,
    name: product.name,
    category: product.category,
    priceCents: product.price_cents,
    currency: product.currency
  }));

  trace.step("catalog", "Built eligible product candidate set", {
    useCase: body.useCase,
    rawProductCount: rawProducts.length,
    eligibleCount: candidates.length,
    candidates
  });

  const decision = await chooseProductWithGroq(
    env,
    {
      objective: body.objective,
      useCase: body.useCase,
      candidates,
      budgetRemainingCents: mandate.budget_remaining_cents,
      allowedCategories,
      allowedMerchants
    },
    trace
  );

  trace.step("selection", "Product selection locked in", {
    groqMeta: decision.meta,
    selectedProductId: decision.selectedProductId,
    selectedMerchantId: decision.selectedMerchantId
  });

  const selectedProduct = products.find(
    (product: any) => product.id === decision.selectedProductId && product.merchant_id === decision.selectedMerchantId
  );
  if (!selectedProduct) throw conflict("selected product missing from catalog");

  trace.step("t3n", "Invoking validate-and-pay as authenticated agent", {
    mandateId: mandate.t3n_record_key,
    merchantId: decision.selectedMerchantId,
    category: selectedProduct.category,
    amountCents: selectedProduct.price_cents,
    paymentMethodType: paymentMethod.type
  });

  const t3nResult = await t3n.validateAndPayAsAgent({
    appAgentId: agent.app_agent_id,
    agentDid: agent.t3n_did,
    userDid: user.did,
    mandateId: mandate.t3n_record_key,
    delegationId: activeDelegation?.id,
    delegationVcId: activeDelegation?.t3n_vc_id,
    merchantId: decision.selectedMerchantId,
    category: selectedProduct.category,
    amountCents: selectedProduct.price_cents,
    paymentMethod: paymentMethod.type === "stablecoin" ? "stablecoin" : "card",
    grant: activeDelegation
      ? {
          contractName: activeDelegation.contract_name,
          contractVersion: activeDelegation.contract_version,
          functions: activeDelegation.functions_json ? JSON.parse(activeDelegation.functions_json) : [],
          allowedHosts: activeDelegation.allowed_hosts_json ? JSON.parse(activeDelegation.allowed_hosts_json) : [],
          vcId: activeDelegation.t3n_vc_id
        }
      : undefined
  });

  trace.step(
    "t3n",
    `T3N policy decision: ${t3nResult.decision.decision}`,
    {
      invocation: t3nResult.invocation,
      decision: t3nResult.decision,
      audit: t3nResult.audit,
      contractLogs: t3nResult.contractLogs
    },
    t3nResult.decision.decision === "approved"
      ? "success"
      : t3nResult.decision.decision === "pending_approval"
        ? "warning"
        : "error"
  );

  const taskInput: AgentTaskInput = {
    agentId: body.agentId,
    mandateId: body.mandateId,
    merchantId: decision.selectedMerchantId,
    productId: decision.selectedProductId,
    paymentMethodId: body.paymentMethodId,
    reason: `${body.objective} | Agent rationale: ${decision.rationale}`
  };

  trace.step("settlement", "Applying mock settlement in VaultPay backend", {
    note: "Balances and receipts are mock; T3N decision above is authoritative for policy.",
    precomputedDecision: t3nResult.decision.decision
  });

  const purchase = await runAgentTask(repo, t3n, taskInput, {
    trace,
    userDid: user.did,
    prevalidatedDecision: t3nResult.decision,
    t3nInvocation: t3nResult.invocation
  });

  const receipt = "receipt" in purchase ? purchase.receipt : undefined;
  const runId = id("run");
  const createdAt = nowIso();
  const traceJson = asJson(trace.toJSON());

  await repo.insert("agent_runs", {
    id: runId,
    agent_id: body.agentId,
    mandate_id: body.mandateId,
    objective: body.objective,
    use_case: body.useCase,
    model: env.groqModel,
    candidate_products_json: asJson(candidates),
    selected_product_id: decision.selectedProductId,
    selected_merchant_id: decision.selectedMerchantId,
    rationale: decision.rationale,
    confidence: decision.confidence,
    purchase_attempt_id: purchase.attempt.id,
    receipt_id: receipt?.id ?? null,
    status: purchase.attempt.decision,
    trace_json: traceJson,
    created_at: createdAt
  });

  trace.success("run", "Agent run completed", {
    runId,
    purchaseAttemptId: purchase.attempt.id,
    receiptId: receipt?.id ?? null,
    finalDecision: purchase.attempt.decision
  });

  await writeAudit(repo, {
    userId: agent.user_id,
    agentId: body.agentId,
    type: "agent_run.completed",
    entityType: "agent_run",
    entityId: runId,
    decision: purchase.attempt.decision,
    payload: {
      objective: body.objective,
      selectedProductId: decision.selectedProductId,
      rationale: decision.rationale,
      traceSteps: trace.toJSON().steps.length
    }
  });

  const runRow = await repo.getById("agent_runs", runId, "agent run");
  return {
    run: decodeRun(runRow),
    purchase,
    trace: trace.toJSON()
  };
}

export function decodeRun(row: any) {
  return {
    ...row,
    candidateProducts: JSON.parse(row.candidate_products_json),
    trace: row.trace_json ? JSON.parse(row.trace_json) : null
  };
}
