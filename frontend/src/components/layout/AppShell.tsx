"use client";

import { useMemo, useState } from "react";
import { AppNavbar } from "@/components/layout/AppNavbar";
import {
  AssetPickerModal,
  CreditCardModal,
  resolveCardPreview,
  resolveWalletPreview,
  WalletModal
} from "@/components/vault/AssetModals";
import { CreateVaultModal } from "@/components/vault/CreateVaultModal";
import { CreateAgentModal } from "@/components/agents/CreateAgentModal";
import { AgentWorkspaceView } from "@/components/agents/AgentWorkspaceView";
import { DemoWelcomeModal } from "@/components/onboarding/DemoWelcomeModal";
import { LoginGate } from "@/components/onboarding/LoginGate";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { VaultView } from "@/components/vault/VaultView";
import { AgentsView } from "@/components/agents/AgentsView";
import { RunsView } from "@/components/runs/RunsView";
import { ApprovalsView } from "@/components/approvals/ApprovalsView";
import { ReceiptsView } from "@/components/receipts/ReceiptsView";
import { useVaultPayApp } from "@/hooks/useVaultPayApp";

export function AppShell() {
  const app = useVaultPayApp();
  const [assetPicker, setAssetPicker] = useState<"card" | "wallet" | null>(null);

  const selectedCard = useMemo(
    () => app.cards.find((card) => card.id === app.selectedPaymentMethodId) ?? app.cards[0] ?? null,
    [app.cards, app.selectedPaymentMethodId]
  );
  const selectedWallet = useMemo(
    () => app.wallets.find((wallet) => wallet.id === app.selectedPaymentMethodId) ?? app.wallets[0] ?? null,
    [app.wallets, app.selectedPaymentMethodId]
  );

  function handleAssetRequest(kind: "card" | "wallet") {
    const items = kind === "card" ? app.cards : app.wallets;
    if (!items.length) {
      if (kind === "card") app.addCard();
      else app.addWallet();
      return;
    }
    if (items.length === 1) {
      app.setSelectedPaymentMethodId(String(items[0].id));
      app.setAssetModal(kind);
      return;
    }
    setAssetPicker(kind);
  }

  if (!app.sessionReady) {
    return <main className="login-shell" />;
  }

  if (!app.session) {
    return (
      <LoginGate signIn={app.signIn} signUp={app.signUp} busy={app.busy} />
    );
  }

  const meta = app.viewMeta[app.view];
  const displayName = app.session.displayName;

  return (
    <div className="app-shell">
      <AppNavbar
        view={app.view}
        onViewChange={app.setView}
        onAssetRequest={handleAssetRequest}
        onLogout={app.logout}
        busy={app.busy}
        pendingApprovals={app.dashboard?.totals.pendingApprovals ?? 0}
        cardCount={app.cards.length}
        walletCount={app.wallets.length}
      />

      <main className="app-main">
        <header className="page-header animate-fade-in-up">
          <h1 className="page-title">{meta.title}</h1>
          <p className="page-subtitle">{meta.subtitle}</p>
        </header>

        <div className="page-content animate-fade-in-up stagger-2">
          {app.view === "dashboard" && (
            <DashboardView
              dashboard={app.dashboard}
              vaults={app.vaults}
              agents={app.agents}
              latestApproval={app.latestApproval}
              busy={app.busy}
              setShowCreateVault={app.setShowCreateVault}
              setShowCreateAgent={app.setShowCreateAgent}
              openAgentWorkspace={app.openAgentWorkspace}
              approveById={app.approveById}
              rejectLatest={app.rejectLatest}
            />
          )}
          {app.view === "agent" && (
            <AgentWorkspaceView
              selectedAgent={app.selectedAgent}
              agentMandate={app.agentMandate}
              agentActivity={app.agentActivity}
              agentRuns={app.agentRuns}
              candidates={app.candidates}
              paymentChoice={app.paymentChoice}
              setPaymentChoice={app.setPaymentChoice}
              runUseCase={app.runUseCase}
              onUseCaseChange={app.onUseCaseChange}
              objective={app.objective}
              setObjective={app.setObjective}
              useCases={app.useCases}
              runSelectedAgent={app.runSelectedAgent}
              busy={app.busy}
              setView={app.setView}
              runTrace={app.runTrace}
              selectedRunId={app.selectedRunId}
              loadRunTrace={app.loadRunTrace}
            />
          )}
          {app.view === "vault" && (
            <VaultView
              session={app.session}
              vaults={app.vaults}
              paymentMethods={app.paymentMethods}
              mandates={app.dashboard?.mandates ?? []}
            />
          )}
          {app.view === "agents" && (
            <AgentsView
              agents={app.agents}
              onRevoke={app.revokeAgent}
              onOpen={app.openAgentWorkspace}
              busy={app.busy}
            />
          )}
          {app.view === "runs" && <RunsView runs={app.dashboard?.recentRuns ?? []} />}
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

      <AssetPickerModal
        open={assetPicker === "card"}
        kind="card"
        items={app.cards}
        selectedId={selectedCard ? String(selectedCard.id) : null}
        onSelect={(id) => {
          app.setSelectedPaymentMethodId(id);
          setAssetPicker(null);
          app.setAssetModal("card");
        }}
        onAdd={() => {
          setAssetPicker(null);
          app.addCard();
        }}
        onClose={() => setAssetPicker(null)}
        busy={app.busy}
      />

      <AssetPickerModal
        open={assetPicker === "wallet"}
        kind="wallet"
        items={app.wallets}
        selectedId={selectedWallet ? String(selectedWallet.id) : null}
        onSelect={(id) => {
          app.setSelectedPaymentMethodId(id);
          setAssetPicker(null);
          app.setAssetModal("wallet");
        }}
        onAdd={() => {
          setAssetPicker(null);
          app.addWallet();
        }}
        onClose={() => setAssetPicker(null)}
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
