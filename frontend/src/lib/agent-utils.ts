import type { AgentPaymentMethod, AgentRole, AnyRow, UseCase } from "@/lib/types";

const ROLE_LABELS: Record<AgentRole, string> = {
  shopping_agent: "Shopping Agent",
  travel_agent: "Travel Agent",
  subscription_agent: "Subscription Agent",
  research_only: "Research Only",
  custom_agent: "Custom Agent"
};

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

export function agentRoleLabel(role: string): string {
  return ROLE_LABELS[role as AgentRole] ?? role.replace(/_/g, " ");
}

export function roleChatMetaName(role: string): string {
  return role.replace(/_agent$/, "").replace(/_/g, " ");
}

export function useCaseForRole(role: string): UseCase {
  switch (role as AgentRole) {
    case "travel_agent":
      return "travel";
    case "subscription_agent":
      return "groceries";
    default:
      return "electronics";
  }
}

export function paymentMethodKinds(agent: AnyRow): Array<"card" | "stablecoin"> {
  const value = String(agent.payment_method ?? "card") as AgentPaymentMethod;
  if (value === "both") return ["card", "stablecoin"];
  if (value === "stablecoin") return ["stablecoin"];
  return ["card"];
}

export function effectivePaymentMethodKinds(agent: AnyRow, vaultMethods: AnyRow[]): Array<"card" | "stablecoin"> {
  return paymentMethodKinds(agent).filter((kind) =>
    vaultMethods.some((method) => method.type === kind && String(method.status ?? "active") === "active")
  );
}

export function paymentMethodLabel(kind: "card" | "stablecoin"): string {
  return kind === "card" ? "Card" : "USDC";
}

export function sumPaymentBalances(methods: AnyRow[]): number {
  return methods.reduce((sum, method) => sum + Number(method.balance_cents ?? method.balanceCents ?? 0), 0);
}
