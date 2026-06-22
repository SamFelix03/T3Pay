export type AppView = "dashboard" | "agent" | "vault" | "marketplace" | "agents" | "runs" | "run" | "approvals" | "receipts";
export type UseCase = "electronics" | "groceries" | "travel";
export type PaymentChoice = "card" | "stablecoin";
export type AssetModal = "card" | "wallet" | null;
export type AgentRole = "shopping_agent" | "research_only" | "travel_agent" | "subscription_agent" | "custom_agent";
export type AgentPaymentMethod = PaymentChoice | "both";

export type AnyRow = Record<string, unknown>;

export type UserSession = {
  userId: string;
  userDid: string;
  displayName: string;
  email: string;
};

export type Dashboard = {
  totals: {
    activeAgents: number;
    delegatedBudgetCents: number;
    pendingApprovals: number;
    blockedAttempts: number;
    totalBalanceCents: number;
    vaultCount: number;
    completedRuns: number;
  };
  vaults: AnyRow[];
  agents: AnyRow[];
  mandates: AnyRow[];
  paymentMethods: AnyRow[];
  approvals: AnyRow[];
  recentRuns: AnyRow[];
  recentActivity: AnyRow[];
};

export type Product = {
  id: string;
  merchant_id: string;
  merchant_name: string;
  name: string;
  category: UseCase;
  price_cents: number;
  currency: string;
};

export type MockCard = {
  holder: string;
  number: string;
  expiry: string;
  cvc: string;
  network: string;
};

export type MockWallet = {
  address: string;
  symbol: string;
};

export type CreateVaultInput = {
  label: string;
  cardId?: string;
  walletId?: string;
};

export type CreateAgentInput = {
  name: string;
  role: AgentRole;
  paymentMethod: AgentPaymentMethod;
  vaultId: string;
  budgetCents: number;
  perPurchaseLimitCents: number;
  approvalThresholdCents: number;
};

export type RunTraceStep = {
  seq: number;
  phase: string;
  title: string;
  status: "info" | "success" | "warning" | "error";
  at: string;
  detail: Record<string, unknown>;
};

export type RunTrace = {
  startedAt: string;
  completedAt: string;
  steps: RunTraceStep[];
};

export type DemoKit = {
  provisioned: boolean;
  vaultId?: string;
  card?: { id: string; display: string; balanceCents: number; currency: string };
  wallet?: { id: string; display: string; balanceCents: number; currency: string };
};
