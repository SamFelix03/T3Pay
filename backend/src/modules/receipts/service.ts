import { SupabaseRepository } from "../../db/supabase";
import { id, sha256Json } from "../../domain/ids";
import { asJson, nowIso } from "../shared";
import { VaultpayT3nGateway } from "../t3n/gateway";

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
