"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppNavbar } from "@/components/layout/AppNavbar";
import { AssetHubModal, CreditCardModal, resolveCardPreview, resolveWalletPreview, WalletModal } from "@/components/vault/AssetHubModal";
import { CreateVaultModal } from "@/components/vault/CreateVaultModal";
import { CreateAgentModal } from "@/components/agents/CreateAgentModal";
import { AgentWorkspaceView } from "@/components/agents/AgentWorkspaceView";
import { DemoWelcomeModal } from "@/components/onboarding/DemoWelcomeModal";
import { LoginGate } from "@/components/onboarding/LoginGate";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { MarketplaceView } from "@/components/marketplace/MarketplaceView";
import { VaultView } from "@/components/vault/VaultView";
import { AgentsView } from "@/components/agents/AgentsView";
import { RunsView } from "@/components/runs/RunsView";
import { RunDetailView } from "@/components/runs/RunDetailView";
import { ApprovalsView } from "@/components/approvals/ApprovalsView";
import { ReceiptsView } from "@/components/receipts/ReceiptsView";
import { useVaultPayApp } from "@/hooks/useVaultPayApp";
import {
  AGENT_PARAM,
  buildAppUrl,
  readViewFromSearchParams,
  RUN_PARAM,
  TAB_PARAM
} from "@/lib/app-navigation";
import type { AppView } from "@/lib/types";

function AppShellInner() {
  const app = useVaultPayApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [assetHub, setAssetHub] = useState<"card" | "wallet" | null>(null);
  const [urlReady, setUrlReady] = useState(false);

  const tab = searchParams.get(TAB_PARAM);
  const agentId = searchParams.get(AGENT_PARAM);
  const runId = searchParams.get(RUN_PARAM);

  const selectedCard = useMemo(
    () => app.cards.find((card) => card.id === app.selectedPaymentMethodId) ?? app.cards[0] ?? null,
    [app.cards, app.selectedPaymentMethodId]
  );
  const selectedWallet = useMemo(
    () => app.wallets.find((wallet) => wallet.id === app.selectedPaymentMethodId) ?? app.wallets[0] ?? null,
    [app.wallets, app.selectedPaymentMethodId]
  );

  const navigate = useCallback(
    (view: AppView, options?: { agentId?: string | null; runId?: string | null }) => {
      router.replace(buildAppUrl(view, options), { scroll: false });
    },
    [router]
  );

  useEffect(() => {
    app.bindNavigator(navigate);
  }, [app.bindNavigator, navigate]);

  useEffect(() => {
    if (!app.sessionReady || !app.session) return;
    app.applyRoute(readViewFromSearchParams(searchParams));
    setUrlReady(true);
  }, [app.sessionReady, app.session, app.applyRoute, tab, agentId, runId]);

  useEffect(() => {
    if (app.view !== "run" || !app.selectedRunId) return;
    void app.ensureRunLoaded(app.selectedRunId);
  }, [app.view, app.selectedRunId, app.ensureRunLoaded]);

  function handleAssetRequest(kind: "card" | "wallet") {
    const items = kind === "card" ? app.cards : app.wallets;
    if (items.length && !app.selectedPaymentMethodId) {
      app.setSelectedPaymentMethodId(String(items[0].id));
    }
    setAssetHub(kind);
  }

  function openAgentWorkspace(agentId: string) {
    navigate("agent", { agentId });
  }

  if (!app.sessionReady) {
    return <main className="login-shell" />;
  }

  if (!app.session) {
    return <LoginGate signIn={app.signIn} signUp={app.signUp} busy={app.busy} />;
  }

  if (!urlReady) {
    return <main className="login-shell" />;
  }

  const meta = app.viewMeta[app.view];
  const displayName = app.session.displayName;

  return (
    <div className="app-shell">
      <AppNavbar
        view={app.view}
        onViewChange={(view) => navigate(view)}
        onAssetRequest={handleAssetRequest}
        onLogout={app.logout}
        busy={app.busy}
        pendingApprovals={app.dashboard?.totals.pendingApprovals ?? 0}
        cardCount={app.cards.length}
        walletCount={app.wallets.length}
      />

      <main className="app-main">
        {app.view !== "agent" && app.view !== "run" ? (
          <header className="page-header animate-fade-in-up">
            <h1 className="page-title">{meta.title}</h1>
            <p className="page-subtitle">{meta.subtitle}</p>
          </header>
        ) : null}

        <div className={`page-content animate-fade-in-up ${app.view === "agent" || app.view === "run" ? "" : "stagger-2"}`}>
          {app.view === "dashboard" && (
            <DashboardView
              dashboard={app.dashboard}
              vaults={app.vaults}
              agents={app.agents}
              paymentMethods={app.paymentMethods}
              latestApproval={app.latestApproval}
              busy={app.busy}
              setShowCreateAgent={app.setShowCreateAgent}
              openAgentWorkspace={openAgentWorkspace}
              revokeAgent={app.revokeAgent}
              approveById={app.approveById}
              rejectLatest={app.rejectLatest}
              onViewAllVaults={() => navigate("vault")}
              onViewAllAgents={() => navigate("agents")}
            />
          )}
          {app.view === "agent" && (
            <AgentWorkspaceView
              selectedAgent={app.selectedAgent}
              agentMandate={app.agentMandate}
              agentActivity={app.agentActivity}
              agentRuns={app.agentRuns}
              busy={app.busy}
              onNavigate={navigate}
              runTrace={app.runTrace}
              selectedRunId={app.selectedRunId}
              loadRunTrace={app.loadRunTrace}
              paymentMethods={app.paymentMethods}
              agentAllowedPaymentMethods={app.agentAllowedPaymentMethods}
              agentChat={app.agentChat}
              chatDraft={app.chatDraft}
              setChatDraft={app.setChatDraft}
              chatLoading={app.chatLoading}
              sendAgentChat={app.sendAgentChat}
              runFromChat={app.runFromChat}
              clearAgentChat={app.clearAgentChat}
              products={app.products}
            />
          )}
          {app.view === "vault" && (
            <VaultView
              vaults={app.vaults}
              paymentMethods={app.paymentMethods}
              agents={app.agents}
              displayName={displayName}
              onCreateVault={() => app.setShowCreateVault(true)}
            />
          )}
          {app.view === "marketplace" && <MarketplaceView products={app.products} />}
          {app.view === "agents" && (
            <AgentsView
              agents={app.agents}
              mandates={app.dashboard?.mandates ?? []}
              onRun={openAgentWorkspace}
              onRevoke={app.revokeAgent}
              onCreate={() => app.setShowCreateAgent(true)}
              busy={app.busy}
            />
          )}
          {app.view === "runs" && (
            <RunsView
              agents={app.agents}
              products={app.products}
              onOpenRun={(id) => navigate("run", { runId: id })}
            />
          )}
          {app.view === "run" && (
            <RunDetailView
              run={app.selectedRun}
              runId={app.selectedRunId}
              trace={app.runTrace}
              agents={app.agents}
              products={app.products}
              onBack={() => navigate("runs")}
              onOpenAgent={openAgentWorkspace}
            />
          )}
          {app.view === "approvals" && (
            <ApprovalsView
              approvals={app.dashboard?.approvals ?? []}
              onApprove={app.approveById}
              onReject={app.rejectLatest}
              busy={app.busy}
            />
          )}
          {app.view === "receipts" && (
            <ReceiptsView
              receipt={app.receipt}
              activity={app.dashboard?.recentActivity ?? []}
              onVerify={app.verifyReceipt}
              busy={app.busy}
            />
          )}
        </div>
      </main>

      <CreateVaultModal
        open={app.showCreateVault}
        cards={app.cards}
        wallets={app.wallets}
        displayName={displayName}
        busy={app.busy}
        onClose={() => app.setShowCreateVault(false)}
        onCreate={app.createVault}
      />

      <CreateAgentModal
        open={app.showCreateAgent}
        vaults={app.vaults}
        paymentMethods={app.paymentMethods}
        busy={app.busy}
        onClose={() => app.setShowCreateAgent(false)}
        onCreate={app.createAgent}
      />

      <AssetHubModal
        open={assetHub === "card"}
        kind="card"
        items={app.cards}
        selectedId={app.selectedPaymentMethodId}
        displayName={displayName}
        onSelect={app.setSelectedPaymentMethodId}
        onAdd={() => void app.addCard(undefined, { openModal: false })}
        onClose={() => setAssetHub(null)}
        busy={app.busy}
      />

      <AssetHubModal
        open={assetHub === "wallet"}
        kind="wallet"
        items={app.wallets}
        selectedId={app.selectedPaymentMethodId}
        displayName={displayName}
        onSelect={app.setSelectedPaymentMethodId}
        onAdd={() => void app.addWallet(undefined, { openModal: false })}
        onClose={() => setAssetHub(null)}
        busy={app.busy}
      />

      <CreditCardModal
        open={app.assetModal === "card"}
        card={resolveCardPreview(selectedCard, displayName)}
        paymentMethod={selectedCard}
        onClose={() => app.setAssetModal(null)}
      />
      <WalletModal
        open={app.assetModal === "wallet"}
        wallet={resolveWalletPreview(selectedWallet)}
        paymentMethod={selectedWallet}
        onClose={() => app.setAssetModal(null)}
      />

      <DemoWelcomeModal
        open={app.showDemoWelcome}
        displayName={displayName}
        cardBalanceCents={app.demoKitBalances.card}
        walletBalanceCents={app.demoKitBalances.wallet}
        onViewCard={() => {
          app.setShowDemoWelcome(false);
          handleAssetRequest("card");
        }}
        onViewWallet={() => {
          app.setShowDemoWelcome(false);
          handleAssetRequest("wallet");
        }}
        onClose={() => app.setShowDemoWelcome(false)}
      />
    </div>
  );
}

export function AppShell() {
  return (
    <Suspense fallback={<main className="login-shell" />}>
      <AppShellInner />
    </Suspense>
  );
}
