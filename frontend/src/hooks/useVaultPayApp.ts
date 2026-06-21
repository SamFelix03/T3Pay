"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { saveCardPreview, saveVaultLabel, saveWalletPreview } from "@/lib/asset-previews";
import { createMockCard, createMockWallet } from "@/lib/mock-assets";
import { clearSession, loadSession, saveSession } from "@/lib/session";
import { toast } from "@/lib/toast";
import type {
  AgentPaymentMethod,
  AgentRole,
  AnyRow,
  AppView,
  AssetModal,
  CreateAgentInput,
  CreateVaultInput,
  Dashboard,
  PaymentChoice,
  Product,
  RunTrace,
  UseCase,
  UserSession,
  DemoKit
} from "@/lib/types";

const USE_CASES: Array<{ id: UseCase; label: string; objective: string }> = [
  { id: "electronics", label: "Electronics", objective: "Find a useful electronics purchase under policy." },
  { id: "groceries", label: "Groceries", objective: "Choose groceries that fit the weekly restock budget." },
  { id: "travel", label: "Travel", objective: "Book travel while respecting approval thresholds." }
];

const VIEW_META: Record<AppView, { title: string; subtitle: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Your vaults, agents, and spending control." },
  agent: { title: "Agent workspace", subtitle: "Run purchases and review audit activity." },
  vault: { title: "Vault", subtitle: "Funding sources, mandates, and sealed credentials." },
  agents: { title: "Agents", subtitle: "T3N DIDs, scoped ADK grants, and revocation." },
  runs: { title: "Runs", subtitle: "Groq selection rationale and sanitized agent memory." },
  approvals: { title: "Approvals", subtitle: "Pending purchases that need your sign-off." },
  receipts: { title: "Receipts", subtitle: "Verifiable purchase proof and audit trail." }
};

export function useVaultPayApp() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [view, setView] = useState<AppView>("dashboard");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [assetModal, setAssetModal] = useState<AssetModal>(null);
  const [showCreateVault, setShowCreateVault] = useState(false);
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>("card");
  const [runUseCase, setRunUseCase] = useState<UseCase>("electronics");
  const [objective, setObjective] = useState(USE_CASES[0].objective);
  const [receipt, setReceipt] = useState<AnyRow | null>(null);
  const [runTrace, setRunTrace] = useState<RunTrace | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [showDemoWelcome, setShowDemoWelcome] = useState(false);
  const [demoKitBalances, setDemoKitBalances] = useState({ card: 100_000, wallet: 100_000 });

  const vaults = dashboard?.vaults ?? [];
  const agents = dashboard?.agents ?? [];
  const paymentMethods = dashboard?.paymentMethods ?? [];
  const cards = paymentMethods.filter((method) => method.type === "card");
  const wallets = paymentMethods.filter((method) => method.type === "stablecoin");

  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? null;
  const agentMandate = dashboard?.mandates?.find((mandate) => mandate.agent_id === selectedAgentId) ?? null;
  const agentVaultId = selectedAgent?.vault_id ? String(selectedAgent.vault_id) : null;
  const vaultPaymentMethods = agentVaultId
    ? paymentMethods.filter((method) => String(method.vault_id) === agentVaultId)
    : [];
  const agentCard = vaultPaymentMethods.find((method) => method.type === "card") ?? cards[0] ?? null;
  const agentWallet = vaultPaymentMethods.find((method) => method.type === "stablecoin") ?? wallets[0] ?? null;
  const selectedPaymentMethod = paymentMethods.find((method) => method.id === selectedPaymentMethodId)
    ?? (paymentChoice === "stablecoin" ? agentWallet : agentCard);

  const latestApproval = dashboard?.approvals?.[0] ?? null;
  const agentActivity = useMemo(
    () => (dashboard?.recentActivity ?? []).filter((event) => event.agent_id === selectedAgentId),
    [dashboard?.recentActivity, selectedAgentId]
  );
  const agentRuns = useMemo(
    () => (dashboard?.recentRuns ?? []).filter((run) => run.agent_id === selectedAgentId),
    [dashboard?.recentRuns, selectedAgentId]
  );
  const candidates = useMemo(
    () => products.filter((product) => product.category === runUseCase).slice(0, 3),
    [products, runUseCase]
  );

  const refresh = useCallback(async (userId = session?.userId) => {
    const dashboardPath = userId ? `/api/dashboard?userId=${encodeURIComponent(userId)}` : "/api/dashboard";
    const [dashboardJson, productJson] = await Promise.all([
      apiGet<Dashboard>(dashboardPath),
      apiGet<{ products: Product[] }>("/merchant/products")
    ]);
    setDashboard(dashboardJson);
    setProducts(productJson.products ?? []);
  }, [session?.userId]);

  useEffect(() => {
    const stored = loadSession();
    if (stored) {
      setSession(stored);
      setDisplayName(stored.displayName);
    }
    setSessionReady(true);
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    refresh().catch((error) => {
      if (session) toast.error((error as Error).message);
    });
  }, [refresh, session, sessionReady]);

  useEffect(() => {
    if (!sessionReady || !session || !dashboard || busy) return;
    if (vaults.length === 0 && paymentMethods.length === 0) {
      ensureDemoKit().catch((error) => toast.error((error as Error).message));
    }
  }, [sessionReady, session, dashboard, vaults.length, paymentMethods.length, busy]);

  function applyDemoKit(kit: DemoKit, name: string) {
    if (!kit.provisioned || !kit.vaultId) return;
    saveVaultLabel(kit.vaultId, "Demo vault");
    if (kit.card?.id) {
      saveCardPreview(kit.card.id, createMockCard(name));
      setSelectedPaymentMethodId(kit.card.id);
    }
    if (kit.wallet?.id) saveWalletPreview(kit.wallet.id, createMockWallet());
    setDemoKitBalances({
      card: kit.card?.balanceCents ?? 100_000,
      wallet: kit.wallet?.balanceCents ?? 100_000
    });
  }

  async function ensureDemoKit() {
    if (!session) return;
    const result = await apiPost<{ demoKit: DemoKit }>(`/api/users/${session.userId}/ensure-demo-kit`, {});
    if (result.demoKit?.provisioned) {
      applyDemoKit(result.demoKit, session.displayName);
      setShowDemoWelcome(true);
      await refresh(session.userId);
    }
  }

  async function login(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    const toastId = toast.loading("Signing in…");
    try {
      const result = await apiPost<{ user: AnyRow; demoKit: DemoKit }>("/api/users/session", { displayName: trimmed });
      const nextSession: UserSession = {
        userId: String(result.user.id),
        userDid: String(result.user.did ?? ""),
        displayName: trimmed
      };
      saveSession(nextSession);
      setSession(nextSession);
      setDisplayName(trimmed);
      if (result.demoKit?.provisioned) {
        applyDemoKit(result.demoKit, trimmed);
        setShowDemoWelcome(true);
      }
      toast.success(`Welcome, ${trimmed}.`, toastId);
      await refresh(nextSession.userId);
      setView("dashboard");
    } catch (error) {
      toast.error((error as Error).message, toastId);
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    clearSession();
    setSession(null);
    setDashboard(null);
    setSelectedAgentId(null);
    setView("dashboard");
  }

  async function ensureFundingVault(): Promise<string> {
    if (vaults.length > 0) return String(vaults[0].id);
    const result = await apiPost<{ vault: AnyRow }>("/api/vaults", { userId: session!.userId });
    saveVaultLabel(String(result.vault.id), "Funding vault");
    return String(result.vault.id);
  }

  async function addCard(vaultId?: string) {
    if (!session) return;
    setBusy(true);
    const toastId = toast.loading("Issuing demo card…");
    try {
      const targetVaultId = vaultId ?? await ensureFundingVault();
      const preview = createMockCard(session.displayName);
      const result = await apiPost<{ paymentMethod: AnyRow }>(`/api/vaults/${targetVaultId}/payment-methods`, {
        type: "card",
        alias: preview.network,
        balanceCents: 100000,
        currency: "USD"
      });
      saveCardPreview(String(result.paymentMethod.id), preview);
      setSelectedPaymentMethodId(String(result.paymentMethod.id));
      toast.success("Demo card added.", toastId);
      await refresh();
      setAssetModal("card");
    } catch (error) {
      toast.error((error as Error).message, toastId);
    } finally {
      setBusy(false);
    }
  }

  async function addWallet(vaultId?: string) {
    if (!session) return;
    setBusy(true);
    const toastId = toast.loading("Creating demo wallet…");
    try {
      const targetVaultId = vaultId ?? await ensureFundingVault();
      const preview = createMockWallet();
      const result = await apiPost<{ paymentMethod: AnyRow }>(`/api/vaults/${targetVaultId}/payment-methods`, {
        type: "stablecoin",
        alias: `${preview.symbol} Wallet`,
        balanceCents: 100000,
        currency: "USDC"
      });
      saveWalletPreview(String(result.paymentMethod.id), preview);
      setSelectedPaymentMethodId(String(result.paymentMethod.id));
      toast.success("Demo wallet added.", toastId);
      await refresh();
      setAssetModal("wallet");
    } catch (error) {
      toast.error((error as Error).message, toastId);
    } finally {
      setBusy(false);
    }
  }

  async function createVault(input: CreateVaultInput) {
    if (!session) return;
    const activeSession = session;
    setBusy(true);
    const toastId = toast.loading("Creating vault…");
    try {
      const vault = await apiPost<{ vault: AnyRow }>("/api/vaults", { userId: activeSession.userId });
      const vaultId = String(vault.vault.id);
      saveVaultLabel(vaultId, input.label.trim() || "Vault");

      async function attachCard() {
        if (input.cardMode === "none") return;
        if (input.cardMode === "existing" && input.existingCardId) {
          const existing = paymentMethods.find((method) => method.id === input.existingCardId);
          if (!existing) return;
          const created = await apiPost<{ paymentMethod: AnyRow }>(`/api/vaults/${vaultId}/payment-methods`, {
            type: "card",
            alias: String(existing.alias),
            balanceCents: Number(existing.balance_cents ?? 0),
            currency: "USD"
          });
          const preview = createMockCard(activeSession.displayName);
          saveCardPreview(String(created.paymentMethod.id), preview);
          return;
        }
        const preview = createMockCard(activeSession.displayName);
        const created = await apiPost<{ paymentMethod: AnyRow }>(`/api/vaults/${vaultId}/payment-methods`, {
          type: "card",
          alias: preview.network,
          balanceCents: 100000,
          currency: "USD"
        });
        saveCardPreview(String(created.paymentMethod.id), preview);
      }

      async function attachWallet() {
        if (input.walletMode === "none") return;
        if (input.walletMode === "existing" && input.existingWalletId) {
          const existing = paymentMethods.find((method) => method.id === input.existingWalletId);
          if (!existing) return;
          const created = await apiPost<{ paymentMethod: AnyRow }>(`/api/vaults/${vaultId}/payment-methods`, {
            type: "stablecoin",
            alias: String(existing.alias),
            balanceCents: Number(existing.balance_cents ?? 0),
            currency: "USDC"
          });
          const preview = createMockWallet();
          saveWalletPreview(String(created.paymentMethod.id), preview);
          return;
        }
        const preview = createMockWallet();
        const created = await apiPost<{ paymentMethod: AnyRow }>(`/api/vaults/${vaultId}/payment-methods`, {
          type: "stablecoin",
          alias: `${preview.symbol} Wallet`,
          balanceCents: 100000,
          currency: "USDC"
        });
        saveWalletPreview(String(created.paymentMethod.id), preview);
      }

      await Promise.all([attachCard(), attachWallet()]);
      toast.success("Vault created.", toastId);
      setShowCreateVault(false);
      await refresh();
    } catch (error) {
      toast.error((error as Error).message, toastId);
    } finally {
      setBusy(false);
    }
  }

  async function createAgent(input: CreateAgentInput) {
    if (!session) return;
    setBusy(true);
    const toastId = toast.loading("Creating agent and ADK grant…");
    try {
      const vaultMethods = paymentMethods.filter((method) => String(method.vault_id) === input.vaultId);
      const hasCard = vaultMethods.some((method) => method.type === "card");
      const hasWallet = vaultMethods.some((method) => method.type === "stablecoin");
      if (input.paymentMethod === "card" && !hasCard) throw new Error("Selected vault has no card.");
      if (input.paymentMethod === "stablecoin" && !hasWallet) throw new Error("Selected vault has no wallet.");
      if (input.paymentMethod === "both" && (!hasCard || !hasWallet)) {
        throw new Error("Selected vault needs both a card and wallet.");
      }

      const mandatePaymentMethods =
        input.paymentMethod === "both" ? ["card", "stablecoin"] : [input.paymentMethod];

      const agent = await apiPost<{ agent: AnyRow }>("/api/agents", {
        userId: session.userId,
        name: input.name,
        role: input.role,
        paymentMethod: input.paymentMethod,
        vaultId: input.vaultId
      });

      await apiPost<{ mandate: AnyRow }>("/api/mandates", {
        userId: session.userId,
        agentId: agent.agent.id,
        budgetCents: input.budgetCents,
        perPurchaseLimitCents: input.perPurchaseLimitCents,
        approvalThresholdCents: input.approvalThresholdCents,
        currency: "USD",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        allowedMerchants: ["electronics-store", "grocery-market", "travel-booking"],
        allowedCategories: ["electronics", "groceries", "travel"],
        paymentMethods: mandatePaymentMethods,
        cadence: "one_time"
      });

      toast.success("Agent created.", toastId);
      setShowCreateAgent(false);
      await refresh();
      openAgentWorkspace(String(agent.agent.id));
    } catch (error) {
      toast.error((error as Error).message, toastId);
    } finally {
      setBusy(false);
    }
  }

  function openAgentWorkspace(agentId: string) {
    setSelectedAgentId(agentId);
    setSelectedRunId(null);
    setRunTrace(null);
    setView("agent");
  }

  async function loadRunTrace(runId: string) {
    setSelectedRunId(runId);
    const result = await apiGet<{ run: AnyRow }>(`/api/agent-runs/${runId}`);
    setRunTrace((result.run.trace as RunTrace | null) ?? null);
  }

  async function runSelectedAgent() {
    if (!selectedAgent || !agentMandate || !selectedPaymentMethod) {
      toast.error("Agent needs a mandate and payment method.");
      return;
    }
    setBusy(true);
    setRunTrace(null);
    setSelectedRunId(null);
    const toastId = toast.loading("Groq is selecting a product. T3N will validate the purchase.");
    try {
      const result = await apiPost<{ run: AnyRow; purchase: AnyRow; trace: RunTrace }>("/api/agent-runs", {
        agentId: selectedAgent.id,
        mandateId: agentMandate.id,
        paymentMethodId: selectedPaymentMethod.id,
        objective,
        useCase: runUseCase,
        candidateLimit: 3
      });
      const purchase = result.purchase as AnyRow | undefined;
      setReceipt((purchase?.receipt as AnyRow | undefined) ?? null);
      setRunTrace(result.trace ?? (result.run.trace as RunTrace | null) ?? null);
      setSelectedRunId(String(result.run.id));
      toast.success(`Run complete · ${result.run.selected_product_id}`, toastId);
      await refresh();
    } catch (error) {
      toast.error((error as Error).message, toastId);
    } finally {
      setBusy(false);
    }
  }

  async function approveById(approvalId: string) {
    setBusy(true);
    const toastId = toast.loading("Resuming approved purchase…");
    try {
      const result = await apiPost<{ result: AnyRow }>(`/api/approvals/${approvalId}/approve`, {});
      setReceipt((result.result?.receipt as AnyRow | undefined) ?? null);
      toast.success("Approval resumed.", toastId);
      await refresh();
    } catch (error) {
      toast.error((error as Error).message, toastId);
    } finally {
      setBusy(false);
    }
  }

  async function rejectLatest(approvalId?: string) {
    const id = approvalId ?? latestApproval?.id;
    if (!id) return;
    setBusy(true);
    const toastId = toast.loading("Rejecting approval…");
    try {
      await apiPost(`/api/approvals/${id}/reject`, {});
      toast.success("Approval rejected.", toastId);
      await refresh();
    } catch (error) {
      toast.error((error as Error).message, toastId);
    } finally {
      setBusy(false);
    }
  }

  async function revokeAgent(agentId: string) {
    setBusy(true);
    const toastId = toast.loading("Revoking ADK grant…");
    try {
      await apiPost(`/api/agents/${agentId}/revoke`, {});
      toast.success("Agent revoked.", toastId);
      if (selectedAgentId === agentId) {
        setSelectedAgentId(null);
        setView("dashboard");
      }
      await refresh();
    } catch (error) {
      toast.error((error as Error).message, toastId);
    } finally {
      setBusy(false);
    }
  }

  async function verifyReceipt(receiptId: string) {
    setBusy(true);
    const toastId = toast.loading("Verifying receipt…");
    try {
      const result = await apiPost<{ receipt: AnyRow }>(`/api/receipts/${receiptId}/verify`, {});
      setReceipt(result.receipt);
      if (result.receipt.valid) toast.success("Receipt verified.", toastId);
      else toast.info("Receipt hash stored (demo mode).", toastId);
    } catch (error) {
      toast.error((error as Error).message, toastId);
    } finally {
      setBusy(false);
    }
  }

  return {
    session,
    sessionReady,
    dashboard,
    vaults,
    agents,
    cards,
    wallets,
    paymentMethods,
    view,
    setView,
    selectedAgentId,
    selectedAgent,
    agentMandate,
    agentActivity,
    agentRuns,
    selectedPaymentMethodId,
    setSelectedPaymentMethodId,
    assetModal,
    setAssetModal,
    showCreateVault,
    setShowCreateVault,
    showCreateAgent,
    setShowCreateAgent,
    busy,
    displayName,
    setDisplayName,
    paymentChoice,
    setPaymentChoice,
    runUseCase,
    setRunUseCase,
    objective,
    setObjective,
    receipt,
    runTrace,
    selectedRunId,
    loadRunTrace,
    showDemoWelcome,
    setShowDemoWelcome,
    demoKitBalances,
    latestApproval,
    candidates,
    useCases: USE_CASES,
    viewMeta: VIEW_META,
    login,
    logout,
    addCard,
    addWallet,
    createVault,
    createAgent,
    openAgentWorkspace,
    runSelectedAgent,
    approveById,
    rejectLatest,
    revokeAgent,
    verifyReceipt,
    refresh: () => refresh().catch((error) => toast.error((error as Error).message)),
    onUseCaseChange: (next: UseCase) => {
      setRunUseCase(next);
      setObjective(USE_CASES.find((item) => item.id === next)?.objective ?? objective);
    }
  };
}

export type VaultPayApp = ReturnType<typeof useVaultPayApp>;
