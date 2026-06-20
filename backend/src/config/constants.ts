export const APP = {
  name: "VaultPay",
  apiVersion: "v1",
  defaultHost: "127.0.0.1",
  defaultPort: 4000
} as const;

export const CONTRACT_RECORD_LIMIT_BYTES = 511;

export const ADK_AGENT_AUTH = {
  grantFunctions: ["validate-and-pay"] as const,
  allowedHosts: ["localhost", "127.0.0.1"] as const,
  grantValiditySeconds: 24 * 60 * 60
} as const;

export const T3N_MAP_TAILS = {
  secrets: "secrets",
  mandates: "mandates",
  agentRoles: "agent_roles",
  audit: "audit",
  receipts: "receipts",
  approvals: "approvals"
} as const;

export const ROLES = ["shopping_agent", "research_only", "travel_agent", "subscription_agent", "custom_agent"] as const;
export const AGENT_STATUSES = ["active", "paused", "revoked"] as const;
export const PAYMENT_METHODS = ["card", "stablecoin", "both"] as const;
export const DECISIONS = ["approved", "rejected", "pending_approval", "revoked", "expired"] as const;

export const MERCHANTS = [
  { id: "electronics-store", name: "Vault Electronics", category: "electronics" },
  { id: "grocery-market", name: "Vault Groceries", category: "groceries" },
  { id: "travel-booking", name: "Vault Travel", category: "travel" }
] as const;
