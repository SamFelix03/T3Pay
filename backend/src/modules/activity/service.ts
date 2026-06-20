import { SupabaseRepository } from "../../db/supabase";
import { id, sha256Json } from "../../domain/ids";
import { asJson, nowIso } from "../shared";

export function writeAudit(
  repo: SupabaseRepository,
  input: {
    userId?: string;
    agentId?: string;
    type: string;
    entityType: string;
    entityId: string;
    decision?: string;
    payload: unknown;
  }
): Promise<void> {
  const createdAt = nowIso();
  const hash = sha256Json({ ...input, createdAt });
  return repo
    .insert("audit_events", {
      id: id("evt"),
      user_id: input.userId ?? null,
      agent_id: input.agentId ?? null,
      type: input.type,
      entity_type: input.entityType,
      entity_id: input.entityId,
      decision: input.decision ?? null,
      hash,
      payload_json: asJson(input.payload),
      created_at: createdAt
    })
    .then(() => undefined);
}

export async function listActivity(repo: SupabaseRepository) {
  const rows = await repo.list("audit_events", { order: { column: "created_at", ascending: false }, limit: 200 });
  return rows.map((row: any) => ({
    ...row,
    payload: JSON.parse(row.payload_json)
  }));
}
