import { SupabaseRepository } from "../../db/supabase";
import { conflict } from "../../domain/errors";
import { id } from "../../domain/ids";
import { issueReceipt } from "../receipts/service";
import { asJson, nowIso } from "../shared";
import { writeAudit } from "../activity/service";
import type { T3nPolicyDecision, VaultpayT3nGateway } from "../t3n/gateway";
import type { RunTrace } from "../agent-runs/trace";

export type AgentTaskInput = {
  agentId: string;
  mandateId: string;
  merchantId: string;
  productId: string;
  paymentMethodId: string;
  reason: string;
};

type RunAgentTaskOptions = {
  trace?: RunTrace;
  userDid?: string;
  prevalidatedDecision?: T3nPolicyDecision;
  t3nInvocation?: Record<string, unknown>;
};

export async function runAgentTask(
  repo: SupabaseRepository,
  t3n: VaultpayT3nGateway,
  input: AgentTaskInput,
  options: RunAgentTaskOptions = {}
) {
  const { trace, prevalidatedDecision } = options;
  return repo.mutate(async () => {
    const agent = await repo.getById<any>("agents", input.agentId, "agent");
    const mandate = await repo.getById<any>("mandates", input.mandateId, "mandate");
    if (mandate.agent_id !== input.agentId) throw conflict("mandate does not belong to agent");
    const delegation = await activeDelegation(repo, input.agentId, input.mandateId);
    const product = await repo.getById<any>("products", input.productId, "product");
    if (product.merchant_id !== input.merchantId) throw conflict("product does not belong to merchant");
    const paymentMethod = await repo.getById<any>("payment_methods", input.paymentMethodId, "payment method");

    const appDecision = decideAppOnly({ agent, mandate, paymentMethod, delegation });
    if (appDecision) {
      trace?.step("policy", `App policy rejected before settlement: ${appDecision.reason}`, appDecision, "error");
    }

    let decision: T3nPolicyDecision | { decision: string; reason: string | null };
    if (appDecision) {
      decision = appDecision;
    } else if (prevalidatedDecision) {
      trace?.step("policy", "Using agent-authenticated T3N decision from prior step", {
        decision: prevalidatedDecision,
        invocation: options.t3nInvocation ?? null
      });
      decision = prevalidatedDecision;
    } else {
      trace?.step("t3n", "Invoking validate-and-pay as user tenant (legacy path)", {
        mandateId: mandate.t3n_record_key,
        agentDid: agent.t3n_did
      });
      decision = await t3n.validateAndPay({
        mandateId: mandate.t3n_record_key,
        appAgentId: agent.app_agent_id,
        agentDid: agent.t3n_did,
        delegationId: delegation.id,
        delegationVcId: delegation.t3n_vc_id,
        merchantId: product.merchant_id,
        category: product.category,
        amountCents: product.price_cents,
        paymentMethod: concretePaymentMethod(paymentMethod.type)
      });
      trace?.step("t3n", `T3N policy decision: ${decision.decision}`, { decision });
    }

    if (decision.decision !== "approved") {
      const approvalId =
        decision.decision === "pending_approval"
          ? await createApproval(repo, t3n, { input, agent, mandate, product, paymentMethod, delegation })
          : null;
      if (approvalId) {
        trace?.warning("approval", "Purchase requires user approval", { approvalId });
      }
      const attempt = await recordAttempt(repo, {
        input,
        agent,
        mandate,
        product,
        paymentMethod,
        decision: decision.decision,
        reason: decision.reason,
        approvalId,
        sanitizedResponse: {
          status: decision.decision,
          reason: decision.reason,
          approvalId,
          agentMemory: agentMemory(input, product)
        }
      });
      trace?.step("settlement", "Recorded non-approved purchase attempt", {
        attemptId: attempt.id,
        decision: attempt.decision,
        reason: attempt.reason
      });
      await writeAudit(repo, {
        userId: agent.user_id,
        agentId: agent.id,
        type: "purchase.attempt_decided",
        entityType: "purchase_attempt",
        entityId: attempt.id,
        decision: decision.decision,
        payload: { reason: decision.reason, approvalId }
      });
      return { attempt };
    }

    trace?.step("settlement", "T3N approved — finalizing payment", {
      productId: product.id,
      amountCents: product.price_cents,
      paymentMethodId: paymentMethod.id
    });
    return executeApprovedPurchase(repo, t3n, {
      input,
      agent,
      mandate,
      product,
      paymentMethod,
      delegation,
      contractDecision: decision,
      trace
    });
  });
}

export async function resumeApprovedTask(repo: SupabaseRepository, t3n: VaultpayT3nGateway, approvalId: string) {
  return repo.mutate(async () => {
    const approval = await repo.getById<any>("approvals", approvalId, "approval");
    if (approval.status !== "approved") throw conflict("approval is not approved");
    const existingAttempts = await repo.list<any>("purchase_attempts", {
      eq: { approval_id: approvalId },
      order: { column: "created_at", ascending: false },
      limit: 1
    });
    const existingAttempt = existingAttempts.find((attempt: any) => attempt.decision === "approved");
    if (existingAttempt) {
      const receipt = existingAttempt.receipt_id ? await repo.maybeById<any>("receipts", existingAttempt.receipt_id) : null;
      return {
        attempt: {
          id: existingAttempt.id,
          decision: existingAttempt.decision,
          reason: existingAttempt.reason,
          approvalId,
          orderId: existingAttempt.order_id,
          receiptId: existingAttempt.receipt_id,
          sanitizedResponse: JSON.parse(existingAttempt.sanitized_response_json),
          createdAt: existingAttempt.created_at
        },
        receipt: receipt
          ? {
              id: receipt.id,
              receiptHash: receipt.receipt_hash,
              receiptType: receipt.receipt_type,
              payload: JSON.parse(receipt.payload_json)
            }
          : null
      };
    }
    const payload = JSON.parse(approval.payload_json);
    const { input, agent, mandate, product, paymentMethod, delegation } = payload;
    const user = await repo.getById<any>("users", agent.user_id, "user");
    const t3nResult = await t3n.validateAndPayAsAgent({
      appAgentId: agent.app_agent_id,
      agentDid: agent.t3n_did,
      userDid: user.did,
      mandateId: mandate.t3n_record_key,
      approvalId,
      delegationId: delegation?.id,
      delegationVcId: delegation?.t3n_vc_id,
      merchantId: product.merchant_id,
      category: product.category,
      amountCents: product.price_cents,
      paymentMethod: concretePaymentMethod(paymentMethod.type)
    });
    const decision = t3nResult.decision;
    if (decision.decision !== "approved") {
      const attempt = await recordAttempt(repo, {
        input,
        agent,
        mandate,
        product,
        paymentMethod,
        decision: decision.decision,
        reason: decision.reason,
        approvalId,
        sanitizedResponse: { status: decision.decision, reason: decision.reason, approvalId, agentMemory: agentMemory(input, product) }
      });
      return { attempt };
    }
    return executeApprovedPurchase(repo, t3n, { input, agent, mandate, product, paymentMethod, delegation, approvalId, contractDecision: decision });
  });
}

async function executeApprovedPurchase(repo: SupabaseRepository, t3n: VaultpayT3nGateway, data: any) {
  const { input, agent, mandate, product, paymentMethod, trace } = data;
  if (paymentMethod.balance_cents < product.price_cents) {
    trace?.error("settlement", "Insufficient payment balance", {
      balanceCents: paymentMethod.balance_cents,
      requiredCents: product.price_cents
    });
    return {
      attempt: await recordAttempt(repo, {
        input,
        agent,
        mandate,
        product,
        paymentMethod,
        decision: "rejected",
        reason: "insufficient_payment_balance",
        approvalId: data.approvalId ?? null,
        sanitizedResponse: {
          status: "rejected",
          reason: "insufficient_payment_balance",
          agentMemory: agentMemory(input, product)
        }
      })
    };
  }
  const attemptId = id("pat");
  const orderId = id("ord");
  const receiptId = id("rcp");
  const createdAt = nowIso();
  const t3nMandate = await t3n.readMandate(mandate.t3n_record_key);
  trace?.step("t3n", "Read mandate from T3N before budget deduction", { mandate: t3nMandate });
  const updatedT3nMandate = await t3n.createMandate({
    ...t3nMandate,
    r: t3nMandate.r - product.price_cents,
    h: undefined
  });
  trace?.step("t3n", "Updated mandate remaining budget on T3N", {
    previousRemainingCents: t3nMandate.r,
    newRemainingCents: updatedT3nMandate.r,
    mandateHash: updatedT3nMandate.h ?? mandate.mandate_hash
  });
  const receipt = await issueReceipt(repo, t3n, {
    receiptId,
    purchaseAttemptId: attemptId,
    agentId: agent.id,
    mandateId: mandate.id,
    merchantId: input.merchantId,
    amountCents: product.price_cents,
    currency: product.currency,
    orderId,
    mandateHash: updatedT3nMandate.h ?? mandate.mandate_hash
  });
  trace?.success("receipt", "Issued verifiable receipt", {
    receiptId: receipt.id,
    receiptHash: receipt.receiptHash,
    receiptType: receipt.receiptType
  });
  const sanitizedResponse = { status: "approved", orderId, agentMemory: agentMemory(input, product) };
  const finalized = await repo.rpc<any>("vaultpay_finalize_purchase", {
    p_attempt_id: attemptId,
    p_order_id: orderId,
    p_receipt_id: receipt.id,
    p_mandate_id: mandate.id,
    p_agent_id: agent.id,
    p_merchant_id: input.merchantId,
    p_product_id: input.productId,
    p_payment_method_id: input.paymentMethodId,
    p_category: product.category,
    p_amount_cents: product.price_cents,
    p_currency: product.currency,
    p_payment_method_type: paymentMethod.type,
    p_approval_id: data.approvalId ?? null,
    p_sanitized_response_json: asJson(sanitizedResponse),
    p_receipt_hash: receipt.receiptHash,
    p_receipt_type: receipt.receiptType,
    p_receipt_payload_json: asJson(receipt.payload),
    p_created_at: createdAt
  });
  const attempt = decodeAttemptRow(finalized.attempt);
  trace?.success("settlement", "Balances and inventory finalized atomically", {
    attemptId: attempt.id,
    orderId,
    paymentMethodId: input.paymentMethodId,
    deductedCents: product.price_cents
  });
  await writeAudit(repo, {
    userId: agent.user_id,
    agentId: agent.id,
    type: "purchase.completed",
    entityType: "purchase_attempt",
    entityId: attempt.id,
    decision: "approved",
    payload: { orderId, receiptId: receipt.id, receiptHash: receipt.receiptHash, atomicFinalize: true }
  });
  return { attempt, receipt };
}

function decideAppOnly(input: { agent: any; mandate: any; paymentMethod: any; delegation: any }): { decision: string; reason: string } | null {
  const { agent, mandate, paymentMethod, delegation } = input;
  if (!agent.vault_id) return { decision: "rejected", reason: "agent_vault_not_assigned" };
  if (String(paymentMethod.vault_id) !== String(agent.vault_id)) {
    return { decision: "rejected", reason: "payment_method_vault_mismatch" };
  }
  if (agent.status === "revoked") return { decision: "revoked", reason: "agent_revoked" };
  if (agent.status === "paused") return { decision: "rejected", reason: "agent_paused" };
  if (!delegation) return { decision: "revoked", reason: "agent_grant_missing" };
  if (delegation.status !== "active") return { decision: "revoked", reason: "agent_grant_revoked" };
  if (mandate.status === "revoked") return { decision: "revoked", reason: "mandate_revoked" };
  if (mandate.status !== "active") return { decision: "rejected", reason: "mandate_not_active" };
  if (paymentMethod.status !== "active") return { decision: "rejected", reason: "payment_method_not_active" };
  return null;
}

async function createApproval(repo: SupabaseRepository, t3n: VaultpayT3nGateway, data: any): Promise<string> {
  const approvalId = id("apv");
  const now = nowIso();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await t3n.createApproval({
    v: 1,
    id: approvalId,
    mid: data.mandate.t3n_record_key,
    aid: data.agent.app_agent_id,
    amt: data.product.price_cents,
    s: "pending",
    exp: Math.floor(expiresAt.getTime() / 1000)
  });
  await repo.insert("approvals", {
      id: approvalId,
      mandate_id: data.mandate.id,
      agent_id: data.agent.id,
      status: "pending",
      payload_json: asJson(data),
      reason: "approval_required",
      expires_at: expiresAt.toISOString(),
      created_at: now
  });
  return approvalId;
}

async function activeDelegation(repo: SupabaseRepository, agentId: string, mandateId: string): Promise<any | null> {
  const delegations = await repo.list<any>("delegations", {
    eq: { agent_id: agentId, mandate_id: mandateId, status: "active" },
    order: { column: "created_at", ascending: false },
    limit: 1
  });
  return delegations[0] ?? null;
}

async function recordAttempt(repo: SupabaseRepository, data: any) {
  const attemptId = id("pat");
  const createdAt = nowIso();
  await repo.insert("purchase_attempts", {
      id: attemptId,
      mandate_id: data.mandate.id,
      agent_id: data.agent.id,
      merchant_id: data.input.merchantId,
      product_id: data.input.productId,
      category: data.product.category,
      amount_cents: data.product.price_cents,
      currency: data.product.currency,
      payment_method: data.paymentMethod?.type ?? data.input.paymentMethodId,
      decision: data.decision,
      reason: data.reason,
      approval_id: data.approvalId,
      order_id: data.orderId ?? null,
      receipt_id: null,
      sanitized_response_json: asJson(data.sanitizedResponse),
      created_at: createdAt
  });
  return { id: attemptId, decision: data.decision, reason: data.reason, approvalId: data.approvalId, orderId: data.orderId, sanitizedResponse: data.sanitizedResponse, createdAt };
}

function concretePaymentMethod(type: "card" | "stablecoin" | "both"): "card" | "stablecoin" {
  if (type === "both") throw conflict("purchase must use a concrete card or stablecoin payment method");
  return type;
}

function agentMemory(input: AgentTaskInput, product: any) {
  return {
    objective: input.reason,
    merchantId: input.merchantId,
    productId: input.productId,
    productName: product.name,
    priceCents: product.price_cents,
    credentialVisibility: "payment secrets absent from agent-visible context"
  };
}

function decodeAttemptRow(row: any) {
  return {
    id: row.id,
    decision: row.decision,
    reason: row.reason,
    approvalId: row.approval_id,
    orderId: row.order_id,
    receiptId: row.receipt_id,
    sanitizedResponse: JSON.parse(row.sanitized_response_json),
    createdAt: row.created_at
  };
}
