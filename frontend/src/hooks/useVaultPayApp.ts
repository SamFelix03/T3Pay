"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { getAssetPreview, saveCardPreview, saveVaultLabel, saveWalletPreview } from "@/lib/asset-previews";
import { createMockCard, createMockWallet } from "@/lib/mock-assets";
import { supabase } from "@/lib/supabase";
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

import { MARKETPLACE_USE_CASES } from "@/lib/marketplace";
import { effectivePaymentMethodKinds, useCaseForRole } from "@/lib/agent-utils";
import type { AgentChatBlock, AgentChatProposal, AgentChatResponse } from "@/lib/agent-chat-types";
import { loadAgentChat, saveAgentChat } from "@/lib/agent-chat-types";

const USE_CASES = MARKETPLACE_USE_CASES.map(({ id, label, objective }) => ({ id, label, objective }));

const VIEW_META: Record<AppView, { title: string; subtitle: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Your vaults, agents, and spending control." },
  agent: { title: "Agent workspace", subtitle: "Run purchases and review audit activity." },
  vault: {
    title: "My Vaults",
    subtitle: "Each vault seals the cards and wallets your agents can spend from under mandate policy."
  },
  marketplace: { title: "Marketplace", subtitle: "Use cases and merchant services available to your agents." },
  agents: { title: "Agents", subtitle: "T3N DIDs, scoped ADK grants, and revocation." },
  runs: { title: "Runs", subtitle: "Groq selection rationale and sanitized agent memory." },
  run: { title: "Run details", subtitle: "Full trace, rationale, and purchase outcome." },
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
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>("card");
  const [runUseCase, setRunUseCase] = useState<UseCase>("electronics");
  const [objective, setObjective] = useState(USE_CASES[0].objective);
  const [receipt, setReceipt] = useState<AnyRow | null>(null);
  const [runTrace, setRunTrace] = useState<RunTrace | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<AnyRow | null>(null);
  const [showDemoWelcome, setShowDemoWelcome] = useState(false);
  const [demoKitBalances, setDemoKitBalances] = useState({ card: 100_000, wallet: 100_000 });
  const [agentChat, setAgentChat] = useState<AgentChatBlock[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const syncingRef = useRef(false);
  const loadedRunIdRef = useRef<string | null>(null);
  const navigatorRef = useRef<
    ((view: AppView, options?: { agentId?: string | null; runId?: string | null }) => void) | null
  >(null);

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
  const agentAllowedPaymentMethods = selectedAgent
    ? effectivePaymentMethodKinds(selectedAgent, vaultPaymentMethods)
    : [];
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

  const vaultMethodKey = useMemo(
    () => vaultPaymentMethods.map((method) => `${method.id}:${method.type}:${method.status}`).join("|"),
    [agentVaultId, paymentMethods]
  );

  useEffect(() => {
    if (!selectedAgent) return;
    const useCase = useCaseForRole(String(selectedAgent.role ?? "shopping_agent"));
    setRunUseCase(useCase);
    setObjective(USE_CASES.find((item) => item.id === useCase)?.objective ?? USE_CASES[0].objective);

    const allowed = effectivePaymentMethodKinds(selectedAgent, vaultPaymentMethods);
    const nextChoice = allowed[0] ?? "card";
    setPaymentChoice(nextChoice);
    const method = nextChoice === "stablecoin" ? agentWallet : agentCard;
    if (method?.id) setSelectedPaymentMethodId(String(method.id));
  }, [selectedAgent?.id, selectedAgent?.role, selectedAgent?.payment_method, agentVaultId, vaultMethodKey, agentCard?.id, agentWallet?.id]);

  useEffect(() => {
    if (!selectedAgentId) {
      setAgentChat([]);
      setChatDraft("");
      return;
    }
    setAgentChat(loadAgentChat(selectedAgentId));
    setChatDraft("");
  }, [selectedAgentId]);

  useEffect(() => {
    if (!selectedAgentId) return;
    saveAgentChat(selectedAgentId, agentChat);
  }, [selectedAgentId, agentChat]);

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
    let active = true;
    supabase.auth.getSession().then(({ data: { session: authSession } }) => {
      if (!active) return;
      if (authSession) {
        bootstrapFromAuth(authSession.user.id).catch((error) => toast.error((error as Error).message));
      } else {
        setSessionReady(true);
      }
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, authSession) => {
      if (authSession) {
        bootstrapFromAuth(authSession.user.id).catch((error) => toast.error((error as Error).message));
      } else {
        setSession(null);
        setDashboard(null);
        setSelectedAgentId(null);
        setRunTrace(null);
        setShowDemoWelcome(false);
        setSessionReady(true);
      }
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function bootstrapFromAuth(userId: string) {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setBusy(true);
    try {
      const result = await apiPost<{ user: AnyRow; demoKit: DemoKit }>("/api/users/sync", {});
      const nextSession: UserSession = {
        userId: String(result.user.id ?? userId),
        userDid: String(result.user.did ?? ""),
        displayName: String(result.user.displayName ?? "User"),
        email: String(result.user.email ?? "")
      };
      setSession(nextSession);
      if (result.demoKit?.provisioned) {
        applyDemoKit(result.demoKit, nextSession.displayName);
        setShowDemoWelcome(true);
      }
      await refresh(nextSession.userId);
    } finally {
      setBusy(false);
      setSessionReady(true);
      syncingRef.current = false;
    }
  }

  async function signIn(email: string, password: string) {
    setBusy(true);
    const toastId = toast.loading("Signing in…");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Signed in.", toastId);
    } catch (error) {
      toast.error((error as Error).message, toastId);
    } finally {
      setBusy(false);
    }
  }

  async function signUp(email: string, password: string, name: string) {
    setBusy(true);
    const toastId = toast.loading("Creating account…");
    try {
      await apiPost("/api/users/register", { email: email.trim(), password, displayName: name.trim() });
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      toast.success("Account created.", toastId);
    } catch (error) {
      toast.error((error as Error).message, toastId);
    } finally {
      setBusy(false);
    }
  }

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
    saveVaultLabel(kit.vaultId, "T3Pay Vault");
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


  async function logout() {
    setBusy(true);
    try {
      await supabase.auth.signOut();
      setSession(null);
      setDashboard(null);
      setSelectedAgentId(null);
      setRunTrace(null);
      setShowDemoWelcome(false);
      setView("dashboard");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function ensureFundingVault(): Promise<string> {
    if (vaults.length > 0) return String(vaults[0].id);
    const result = await apiPost<{ vault: AnyRow }>("/api/vaults", { userId: session!.userId });
    saveVaultLabel(String(result.vault.id), "Funding vault");
    return String(result.vault.id);
  }

  async function addCard(vaultId?: string, options?: { openModal?: boolean }) {
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
      if (options?.openModal !== false) setAssetModal("card");
    } catch (error) {
      toast.error((error as Error).message, toastId);
    } finally {
      setBusy(false);
    }
  }

  async function addWallet(vaultId?: string, options?: { openModal?: boolean }) {
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
      if (options?.openModal !== false) setAssetModal("wallet");
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

      if (input.cardId) {
        const existing = paymentMethods.find((method) => String(method.id) === input.cardId);
        if (existing) {
          const created = await apiPost<{ paymentMethod: AnyRow }>(`/api/vaults/${vaultId}/payment-methods`, {
            type: "card",
            alias: String(existing.alias),
            balanceCents: Number(existing.balance_cents ?? 0),
            currency: "USD"
          });
          const preview = getAssetPreview(String(existing.id));
          saveCardPreview(
            String(created.paymentMethod.id),
            preview?.type === "card" ? preview.card : createMockCard(activeSession.displayName)
          );
        }
      }

      if (input.walletId) {
        const existing = paymentMethods.find((method) => String(method.id) === input.walletId);
        if (existing) {
          const created = await apiPost<{ paymentMethod: AnyRow }>(`/api/vaults/${vaultId}/payment-methods`, {
            type: "stablecoin",
            alias: String(existing.alias),
            balanceCents: Number(existing.balance_cents ?? 0),
            currency: "USDC"
          });
          const preview = getAssetPreview(String(existing.id));
          saveWalletPreview(
            String(created.paymentMethod.id),
            preview?.type === "stablecoin" ? preview.wallet : createMockWallet()
          );
        }
      }

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

  const bindNavigator = useCallback(
    (fn: (view: AppView, options?: { agentId?: string | null; runId?: string | null }) => void) => {
      navigatorRef.current = fn;
    },
    []
  );

  const applyRoute = useCallback(
    (route: { view: AppView; agentId: string | null; runId: string | null }) => {
      setView(route.view);
      if (route.view === "agent" && route.agentId) {
        setSelectedAgentId(route.agentId);
      }
      if (route.view === "run" && route.runId) {
        setSelectedRunId(route.runId);
        if (loadedRunIdRef.current !== route.runId) {
          setSelectedRun(null);
          setRunTrace(null);
        }
      }
    },
    []
  );

  const ensureRunLoaded = useCallback(async (runId: string) => {
    if (loadedRunIdRef.current === runId) return;
    const requestedRunId = runId;
    loadedRunIdRef.current = requestedRunId;
    try {
      const result = await apiGet<{ run: AnyRow }>(`/api/agent-runs/${requestedRunId}`);
      if (loadedRunIdRef.current !== requestedRunId) return;
      setSelectedRun(result.run);
      setRunTrace((result.run.trace as RunTrace | null) ?? null);
    } catch (error) {
      if (loadedRunIdRef.current === requestedRunId) {
        loadedRunIdRef.current = null;
      }
      toast.error((error as Error).message);
    }
  }, []);

  const openAgentWorkspace = useCallback((agentId: string) => {
    navigatorRef.current?.("agent", { agentId });
  }, []);

  function clearAgentChat() {
    if (!selectedAgentId) return;
    setAgentChat([]);
    setChatDraft("");
    saveAgentChat(selectedAgentId, []);
  }

  async function loadRunTrace(runId: string) {
    setSelectedRunId(runId);
    const result = await apiGet<{ run: AnyRow }>(`/api/agent-runs/${runId}`);
    setRunTrace((result.run.trace as RunTrace | null) ?? null);
  }

  async function runSelectedAgent(overrides?: { objective?: string; useCase?: UseCase }) {
    if (!selectedAgent || !agentMandate || !selectedPaymentMethod) {
      toast.error("Agent needs a mandate and payment method.");
      return null;
    }
    const objectiveText = overrides?.objective ?? objective;
    const useCaseValue = overrides?.useCase ?? runUseCase;
    setBusy(true);
    setRunTrace(null);
    setSelectedRunId(null);
    const toastId = toast.loading("Running purchase workflow through T3N policy.");
    try {
      const result = await apiPost<{ run: AnyRow; purchase: AnyRow; trace: RunTrace }>("/api/agent-runs", {
        agentId: selectedAgent.id,
        mandateId: agentMandate.id,
        paymentMethodId: selectedPaymentMethod.id,
        objective: objectiveText,
        useCase: useCaseValue,
        candidateLimit: 3
      });
      const purchase = result.purchase as AnyRow | undefined;
      setReceipt((purchase?.receipt as AnyRow | undefined) ?? null);
      setRunTrace(result.trace ?? (result.run.trace as RunTrace | null) ?? null);
      setSelectedRunId(String(result.run.id));
      toast.success(`Run complete · ${result.run.selected_product_id}`, toastId);
      await refresh();
      return result;
    } catch (error) {
      toast.error((error as Error).message, toastId);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function sendAgentChat() {
    const text = chatDraft.trim();
    if (!text || !selectedAgent || chatLoading || busy) return;
    const userMessage: AgentChatBlock = { role: "user", text };
    const history = [...agentChat, userMessage];
    setAgentChat(history);
    setChatDraft("");
    setChatLoading(true);
    try {
      const result = await apiPost<AgentChatResponse>("/api/agent-chat", {
        agentId: String(selectedAgent.id),
        messages: history.map((block) => ({
          role: block.role,
          content: block.text ?? (block.purchaseSuccess ? `Order placed for ${block.purchaseSuccess.productName}` : "")
        }))
      });
      setAgentChat([
        ...history,
        {
          role: "assistant",
          text: result.reply,
          proposals: result.proposals,
          canRun: result.canRun,
          objective: result.objective,
          useCase: result.useCase ?? undefined
        }
      ]);
      if (result.objective) setObjective(result.objective);
      if (result.useCase) setRunUseCase(result.useCase);
    } catch (error) {
      setAgentChat([
        ...history,
        { role: "assistant", text: (error as Error).message }
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  async function runFromChat(block: AgentChatBlock, proposal?: AgentChatProposal) {
    const objectiveText = proposal
      ? `${block.objective ?? objective} — prefer ${proposal.name}`
      : block.objective ?? objective;
    const useCaseValue = block.useCase ?? runUseCase;
    const result = await runSelectedAgent({ objective: objectiveText, useCase: useCaseValue });
    if (!result) return;
    const run = result.run;
    const status = String(run.status ?? "");
    const productId = String(run.selected_product_id ?? "");
    const catalogProduct = products.find((item) => item.id === productId);
    const productName = proposal?.name ?? catalogProduct?.name ?? productId.replace(/^prd_/, "").replace(/_/g, " ");
    const priceCents = proposal?.priceCents ?? catalogProduct?.price_cents ?? 0;
    const merchantName = proposal?.merchantName ?? catalogProduct?.merchant_name;

    if (status === "approved") {
      setAgentChat((current) => [
        ...current,
        {
          role: "assistant",
          purchaseSuccess: { productName, priceCents, merchantName }
        }
      ]);
      return;
    }

    const rationale = String(run.rationale ?? "");
    setAgentChat((current) => [
      ...current,
      {
        role: "assistant",
        text: rationale
          ? `I couldn't complete that purchase (${status}). ${rationale}`
          : `I couldn't complete that purchase (${status}).`
      }
    ]);
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
        navigatorRef.current?.("dashboard");
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
      return result.receipt;
    } catch (error) {
      toast.error((error as Error).message, toastId);
      return null;
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
    setSelectedAgentId,
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
    agentAllowedPaymentMethods,
    paymentChoice,
    setPaymentChoice: (next: PaymentChoice) => {
      if (!agentAllowedPaymentMethods.includes(next)) return;
      setPaymentChoice(next);
      const method = next === "stablecoin" ? agentWallet : agentCard;
      if (method?.id) setSelectedPaymentMethodId(String(method.id));
    },
    runUseCase,
    setRunUseCase,
    objective,
    setObjective,
    receipt,
    runTrace,
    selectedRunId,
    selectedRun,
    loadRunTrace,
    applyRoute,
    ensureRunLoaded,
    bindNavigator,
    clearAgentChat,
    showDemoWelcome,
    setShowDemoWelcome,
    demoKitBalances,
    latestApproval,
    candidates,
    products,
    viewMeta: VIEW_META,
    signIn,
    signUp,
    logout,
    addCard,
    addWallet,
    createVault,
    createAgent,
    openAgentWorkspace,
    runSelectedAgent,
    sendAgentChat,
    runFromChat,
    agentChat,
    chatDraft,
    setChatDraft,
    chatLoading,
    approveById,
    rejectLatest,
    revokeAgent,
    verifyReceipt,
    refresh: () => refresh().catch((error) => toast.error((error as Error).message))
  };
}

export type VaultPayApp = ReturnType<typeof useVaultPayApp>;
