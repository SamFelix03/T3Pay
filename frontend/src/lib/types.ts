export type AppView = "dashboard" | "vault" | "agents" | "runs" | "approvals" | "receipts";
export type UseCase = "electronics" | "groceries" | "travel";
export type PaymentChoice = "card" | "stablecoin";
export type AssetModal = "card" | "wallet" | null;

export type AnyRow = Record<string, unknown>;

export type Dashboard = {
  totals: {
    activeAgents: number;
    delegatedBudgetCents: number;
    pendingApprovals: number;
    blockedAttempts: number;
  };
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

export type Workspace = {
  userId: string;
  userDid: string;
  displayName: string;
  vaultId: string;
  cardId: string;
  walletId: string;
  agentId: string;
  mandateId: string;
  cardPreview: MockCard;
  walletPreview: MockWallet;
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
