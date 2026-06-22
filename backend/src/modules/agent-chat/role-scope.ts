import { ROLES } from "../../config/constants";

type AgentRole = (typeof ROLES)[number];

const ROLE_LABELS: Record<AgentRole, string> = {
  shopping_agent: "Shopping Agent",
  travel_agent: "Travel Agent",
  subscription_agent: "Subscription Agent",
  research_only: "Research Only",
  custom_agent: "Custom Agent"
};

const ROLE_RESPONSIBILITIES: Record<AgentRole, string> = {
  shopping_agent:
    "Help users shop for electronics and everyday goods within mandate limits. Do not book travel or manage unrelated subscriptions.",
  travel_agent:
    "Help users book travel such as hotels, transport, and trip services within mandate limits. Do not purchase unrelated electronics or grocery baskets.",
  subscription_agent:
    "Help users with recurring purchases and grocery-style baskets within mandate limits. Do not book travel unless it is part of a subscription service.",
  research_only:
    "Research and advise only. Never initiate purchases, propose checkout, or move spending workflows forward.",
  custom_agent: "Help users complete purchases allowed by their mandate across supported merchant categories."
};

const ROLE_USE_CASES: Record<AgentRole, Array<"electronics" | "groceries" | "travel">> = {
  shopping_agent: ["electronics", "groceries"],
  travel_agent: ["travel"],
  subscription_agent: ["groceries"],
  research_only: [],
  custom_agent: ["electronics", "groceries", "travel"]
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as AgentRole] ?? role.replace(/_/g, " ");
}

export function roleResponsibility(role: string): string {
  return ROLE_RESPONSIBILITIES[role as AgentRole] ?? ROLE_RESPONSIBILITIES.custom_agent;
}

export function roleAllowsPurchases(role: string): boolean {
  return role !== "research_only";
}

export function useCasesForRole(role: string): Array<"electronics" | "groceries" | "travel"> {
  return ROLE_USE_CASES[role as AgentRole] ?? ROLE_USE_CASES.custom_agent;
}
