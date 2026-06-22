import { SupabaseRepository } from "../../db/supabase";
import { id, sha256Json } from "../../domain/ids";
import { asJson, nowIso } from "../shared";
import { VaultpayT3nGateway } from "../t3n/gateway";

export type ReceiptListRow = {
  id: string;
  purchaseAttemptId: string;
  receiptHash: string;
  receiptType: string;
  createdAt: string;
  agentId: string;
  agentName: string;
  merchantId: string;
  productId: string;
  amountCents: number;
  currency: string;
  orderId: string | null;
  mandateId: string;
};

export async function listReceipts(repo: SupabaseRepository, userId?: string | null): Promise<ReceiptListRow[]> {
  const [rawReceipts, agents, attempts] = await Promise.all([
    repo.list<any>("receipts", { order: { column: "created_at", ascending: false }, limit: 100 }),
    userId
      ? repo.list<any>("agents", { eq: { user_id: userId } })
      : repo.list<any>("agents", { order: { column: "created_at", ascending: false } }),
    repo.list<any>("purchase_attempts", { order: { column: "created_at", ascending: false }, limit: 200 })
  ]);
  const agentIds = new Set(agents.map((agent: any) => agent.id));
  const agentById = new Map(agents.map((agent: any) => [agent.id, agent]));
  const attemptById = new Map(attempts.map((attempt: any) => [attempt.id, attempt]));

  return rawReceipts
    .map((row: any) => {
      const attempt = attemptById.get(row.purchase_attempt_id);
      if (!attempt || !agentIds.has(attempt.agent_id)) return null;
      const agent = agentById.get(attempt.agent_id);
      return {
        id: row.id,
        purchaseAttemptId: row.purchase_attempt_id,
        receiptHash: row.receipt_hash,
        receiptType: row.receipt_type,
        createdAt: row.created_at,
        agentId: attempt.agent_id,
        agentName: agent ? String(agent.name) : String(attempt.agent_id),
        merchantId: attempt.merchant_id,
        productId: attempt.product_id,
        amountCents: attempt.amount_cents,
        currency: attempt.currency,
        orderId: attempt.order_id ?? null,
        mandateId: attempt.mandate_id
      } satisfies ReceiptListRow;
    })
    .filter((row): row is ReceiptListRow => row !== null);
}

export function issueReceipt(
  repo: SupabaseRepository,
  t3n: VaultpayT3nGateway,
  payload: {
    receiptId?: string;
    purchaseAttemptId: string;
    agentId: string;
    mandateId: string;
    merchantId: string;
    amountCents: number;
    currency: string;
    orderId: string;
    mandateHash: string;
  }
): Promise<{ id: string; receiptHash: string; receiptType: string; payload: any }> {
  const receiptId = payload.receiptId ?? id("rcp");
  return t3n
    .issueReceipt({
      v: 1,
      id: receiptId,
      pid: payload.purchaseAttemptId,
      mid: payload.mandateId,
      aid: payload.agentId,
      mer: payload.merchantId,
      amt: payload.amountCents,
      ord: payload.orderId,
      mh: payload.mandateHash
    })
    .then(async (contractReceipt) => {
      const receiptPayload = {
        v: 1,
        type: "deterministic_hash_receipt",
        ...payload,
        contractReceipt,
        issuedAt: nowIso()
      };
      const receiptHash = sha256Json(receiptPayload);
      if (!payload.receiptId) {
        await repo.insert("receipts", {
          id: receiptId,
          purchase_attempt_id: payload.purchaseAttemptId,
          receipt_hash: receiptHash,
          receipt_type: "deterministic_hash",
          payload_json: asJson(receiptPayload),
          created_at: receiptPayload.issuedAt
        });
      }
      return { id: receiptId, receiptHash, receiptType: "deterministic_hash", payload: receiptPayload };
    });
}

export async function verifyReceipt(repo: SupabaseRepository, receiptId: string) {
  const row = await repo.getById<any>("receipts", receiptId, "receipt");
  const payload = JSON.parse(row.payload_json);
  return {
    id: row.id,
    receiptHash: row.receipt_hash,
    receiptType: row.receipt_type,
    valid: sha256Json(payload) === row.receipt_hash,
    payload,
    createdAt: row.created_at
  };
}
