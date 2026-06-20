"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { createMockCard, createMockWallet } from "@/lib/mock-assets";
import type {
  AnyRow,
  AppView,
  AssetModal,
  Dashboard,
  PaymentChoice,
  Product,
  UseCase,
  Workspace
} from "@/lib/types";

const USE_CASES: Array<{ id: UseCase; label: string; objective: string }> = [
  { id: "electronics", label: "Electronics", objective: "Find a useful electronics purchase under policy." },
  { id: "groceries", label: "Groceries", objective: "Choose groceries that fit the weekly restock budget." },
  { id: "travel", label: "Travel", objective: "Book travel while respecting approval thresholds." }
];

const VIEW_META: Record<AppView, { title: string; subtitle: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Spending control, agent authority, and live policy state." },
  vault: { title: "Vault", subtitle: "Funding sources, mandates, and sealed credentials." },
  agents: { title: "Agents", subtitle: "T3N DIDs, scoped ADK grants, and revocation." },
  runs: { title: "Runs", subtitle: "Groq selection rationale and sanitized agent memory." },
  approvals: { title: "Approvals", subtitle: "Pending purchases that need your sign-off." },
  receipts: { title: "Receipts", subtitle: "Verifiable purchase proof and audit trail." }
};

export function useVaultPayApp() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [view, setView] = useState<AppView>("dashboard");
  const [assetModal, setAssetModal] = useState<AssetModal>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Ready.");
  const [statusTone, setStatusTone] = useState<"neutral" | "error" | "success">("neutral");
  const [displayName, setDisplayName] = useState("");
  const [agentName, setAgentName] = useState("Shopping Agent");
  const [agentRole, setAgentRole] = useState<"shopping_agent" | "research_only" | "travel_agent" | "subscription_agent" | "custom_agent">("shopping_agent");
  const [agentPaymentMethod, setAgentPaymentMethod] = useState<PaymentChoice | "both">("both");
  const [mandateBudget, setMandateBudget] = useState(500);
  const [perPurchaseLimit, setPerPurchaseLimit] = useState(300);
  const [approvalThreshold, setApprovalThreshold] = useState(150);
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>("card");
  const [runUseCase, setRunUseCase] = useState<UseCase>("electronics");
  const [objective, setObjective] = useState(USE_CASES[0].objective);
  const [receipt, setReceipt] = useState<AnyRow | null>(null);

  const latestAgent = dashboard?.agents?.[0] ?? null;
  const latestMandate = dashboard?.mandates?.[0] ?? null;
  const latestApproval = dashboard?.approvals?.[0] ?? null;
  const card = dashboard?.paymentMethods?.find((method) => method.type === "card") ?? null;
  const wallet = dashboard?.paymentMethods?.find((method) => method.type === "stablecoin") ?? null;
  const selectedPaymentMethod = paymentChoice === "stablecoin" ? wallet : card;
  const candidates = useMemo(
    () => products.filter((product) => product.category === runUseCase).slice(0, 3),
    [products, runUseCase]
  );

  const notify = useCallback((message: string, tone: "neutral" | "error" | "success" = "neutral") => {
    setStatus(message);
    setStatusTone(tone);
  }, []);

  const refresh = useCallback(async (userId = workspace?.userId) => {
    const dashboardPath = userId ? `/api/dashboard?userId=${encodeURIComponent(userId)}` : "/api/dashboard";
    const [dashboardJson, productJson] = await Promise.all([
      apiGet<Dashboard>(dashboardPath),
      apiGet<{ products: Product[] }>("/merchant/products")
    ]);
    setDashboard(dashboardJson);
    setProducts(productJson.products ?? []);
  }, [workspace?.userId]);

  useEffect(() => {
    refresh().catch((error) => notify(`Backend unavailable: ${(error as Error).message}`, "error"));
  }, [refresh, notify]);

  async function enterApp() {
    setBusy(true);
    notify("Creating vault, agent DID, mandate, and ADK grant…");
    try {
      const generatedCard = createMockCard(displayName);
      const generatedWallet = createMockWallet();
      const session = await apiPost<{ user: AnyRow }>("/api/users/session", { displayName });
      const vault = await apiPost<{ vault: AnyRow }>("/api/vaults", { userId: session.user.id });
      const [cardResult, walletResult] = await Promise.all([
        apiPost<{ paymentMethod: AnyRow }>(`/api/vaults/${vault.vault.id}/payment-methods`, {
          type: "card",
          alias: `${generatedCard.network}`,
          balanceCents: 100000,
          currency: "USD"
        }),
        apiPost<{ paymentMethod: AnyRow }>(`/api/vaults/${vault.vault.id}/payment-methods`, {
          type: "stablecoin",
          alias: `${generatedWallet.symbol} Wallet`,
          balanceCents: 100000,
          currency: "USDC"
        })
      ]);
      const agent = await apiPost<{ agent: AnyRow }>("/api/agents", {
        userId: session.user.id,
        name: agentName,
        role: agentRole,
        paymentMethod: agentPaymentMethod
      });
      const mandatePaymentMethods =
        agentPaymentMethod === "both" ? ["card", "stablecoin"] : [agentPaymentMethod];
      const mandate = await apiPost<{ mandate: AnyRow }>("/api/mandates", {
        userId: session.user.id,
        agentId: agent.agent.id,
        budgetCents: Math.round(mandateBudget * 100),
        perPurchaseLimitCents: Math.round(perPurchaseLimit * 100),
        approvalThresholdCents: Math.round(approvalThreshold * 100),
        currency: "USD",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        allowedMerchants: ["electronics-store", "grocery-market", "travel-booking"],
        allowedCategories: ["electronics", "groceries", "travel"],
        paymentMethods: mandatePaymentMethods,
        cadence: "one_time"
      });
      setWorkspace({
        userId: String(session.user.id),
        userDid: String(session.user.did ?? ""),
        displayName,
        vaultId: String(vault.vault.id),
        cardId: String(cardResult.paymentMethod.id),
        walletId: String(walletResult.paymentMethod.id),
        agentId: String(agent.agent.id),
        mandateId: String(mandate.mandate.id),
        cardPreview: generatedCard,
        walletPreview: generatedWallet
      });
      notify("Vault ready. Agent grant is active.", "success");
      await refresh(String(session.user.id));
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function runAgent() {
    if (!latestAgent || !latestMandate || !selectedPaymentMethod) {
      notify("Set up vault and payment methods first.", "error");
      return;
    }
    setBusy(true);
    notify("Groq is selecting a product. T3N will validate the purchase.");
    try {
      const result = await apiPost<{ run: AnyRow; purchase: AnyRow }>("/api/agent-runs", {
        agentId: latestAgent.id,
        mandateId: latestMandate.id,
        paymentMethodId: selectedPaymentMethod.id,
        objective,
        useCase: runUseCase,
        candidateLimit: 3
      });
      const purchase = result.purchase as AnyRow | undefined;
      setReceipt((purchase?.receipt as AnyRow | undefined) ?? null);
      notify(`Run complete · ${result.run.selected_product_id}`, "success");
      await refresh();
      setView("runs");
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function runDemo() {
    setBusy(true);
    notify("Running full E2E demo through production services…");
    try {
      const demo = await apiPost<AnyRow>("/api/demo/start", {
        displayName,
        cardBalanceCents: 100000,
        stablecoinBalanceCents: 100000
      });
      const generatedCard = createMockCard(displayName);
      const generatedWallet = createMockWallet();
      const user = demo.user as AnyRow;
      const vault = demo.vault as AnyRow;
      const paymentMethods = demo.paymentMethods as AnyRow;
      const agent = demo.agent as AnyRow;
      const mandate = demo.mandate as AnyRow;
      setWorkspace({
        userId: String(user.id),
        userDid: String(user.did ?? ""),
        displayName,
        vaultId: String(vault.id),
        cardId: String(paymentMethods.cardId),
        walletId: String(paymentMethods.walletId),
        agentId: String(agent.id),
        mandateId: String(mandate.id),
        cardPreview: generatedCard,
        walletPreview: generatedWallet
      });
      const purchases = demo.purchases as AnyRow;
      const approvalReceipt = (purchases?.approvalScenario as AnyRow | undefined)?.receipt as AnyRow | undefined;
      const stableReceipt = (purchases?.stablecoin as AnyRow | undefined)?.receipt as AnyRow | undefined;
      const cardReceipt = (purchases?.card as AnyRow | undefined)?.receipt as AnyRow | undefined;
      setReceipt(approvalReceipt ?? stableReceipt ?? cardReceipt ?? null);
      notify("E2E demo complete.", "success");
      await refresh(String(user.id));
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function approveById(approvalId: string) {
    setBusy(true);
    notify("Resuming approved purchase…");
    try {
      const result = await apiPost<{ result: AnyRow }>(`/api/approvals/${approvalId}/approve`, {});
      setReceipt((result.result?.receipt as AnyRow | undefined) ?? null);
      notify("Approval resumed.", "success");
      await refresh();
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function approveLatest() {
    if (!latestApproval) return;
    await approveById(String(latestApproval.id));
  }

  async function rejectLatest(approvalId?: string) {
    const id = approvalId ?? latestApproval?.id;
    if (!id) return;
    setBusy(true);
    try {
      await apiPost(`/api/approvals/${id}/reject`, {});
      notify("Approval rejected.");
      await refresh();
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function revokeAgent() {
    if (!latestAgent) return;
    setBusy(true);
    notify("Revoking ADK grant…");
    try {
      await apiPost(`/api/agents/${latestAgent.id}/revoke`, {});
      notify("Agent revoked.", "success");
      await refresh();
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function verifyReceipt(receiptId: string) {
    setBusy(true);
    try {
      const result = await apiPost<{ receipt: AnyRow }>(`/api/receipts/${receiptId}/verify`, {});
      setReceipt(result.receipt);
      notify(result.receipt.valid ? "Receipt verified." : "Receipt hash stored (demo mode).", result.receipt.valid ? "success" : "neutral");
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return {
    workspace,
    dashboard,
    view,
    setView,
    assetModal,
    setAssetModal,
    busy,
    status,
    statusTone,
    displayName,
    setDisplayName,
    agentName,
    setAgentName,
    agentRole,
    setAgentRole,
    agentPaymentMethod,
    setAgentPaymentMethod,
    mandateBudget,
    setMandateBudget,
    perPurchaseLimit,
    setPerPurchaseLimit,
    approvalThreshold,
    setApprovalThreshold,
    paymentChoice,
    setPaymentChoice,
    runUseCase,
    setRunUseCase,
    objective,
    setObjective,
    receipt,
    setReceipt,
    latestAgent,
    latestMandate,
    latestApproval,
    card,
    wallet,
    candidates,
    useCases: USE_CASES,
    viewMeta: VIEW_META,
    enterApp,
    runAgent,
    runDemo,
    approveLatest,
    approveById,
    rejectLatest,
    revokeAgent,
    verifyReceipt,
    refresh: () => refresh().catch((error) => notify((error as Error).message, "error")),
    onUseCaseChange: (next: UseCase) => {
      setRunUseCase(next);
      setObjective(USE_CASES.find((item) => item.id === next)?.objective ?? objective);
    }
  };
}

export type VaultPayApp = ReturnType<typeof useVaultPayApp>;
