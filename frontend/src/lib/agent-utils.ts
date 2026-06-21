import type { AnyRow } from "@/lib/types";
import type { AgentPaymentMethod } from "@/lib/types";

export function mandateForAgent(mandates: AnyRow[], agentId: string): AnyRow | undefined {
  return mandates.find((mandate) => String(mandate.agent_id) === agentId);
}

export function grantStatusLabel(agent: AnyRow): string {
  const grant = agent.latestGrant as AnyRow | undefined;
  if (agent.status === "revoked") return "revoked";
  if (grant?.status) return String(grant.status).replace(/\s+/g, "_");
  if (grant?.revokedAt) return "revoked";
  return grant ? "active" : "no grant";
}

export function paymentMethodKinds(agent: AnyRow): Array<"card" | "stablecoin"> {
  const value = String(agent.payment_method ?? "card") as AgentPaymentMethod;
  if (value === "both") return ["card", "stablecoin"];
  if (value === "stablecoin") return ["stablecoin"];
  return ["card"];
}

export function sumPaymentBalances(methods: AnyRow[]): number {
  return methods.reduce((sum, method) => sum + Number(method.balance_cents ?? method.balanceCents ?? 0), 0);
}
