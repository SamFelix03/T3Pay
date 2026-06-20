"use client";

import { AppNavbar } from "@/components/layout/AppNavbar";
import { CreditCardModal, WalletModal } from "@/components/vault/AssetModals";
import { LoginGate } from "@/components/onboarding/LoginGate";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { VaultView } from "@/components/vault/VaultView";
import { AgentsView } from "@/components/agents/AgentsView";
import { RunsView } from "@/components/runs/RunsView";
import { ApprovalsView } from "@/components/approvals/ApprovalsView";
import { ReceiptsView } from "@/components/receipts/ReceiptsView";
import { StatusBanner } from "@/components/ui/primitives";
import { useVaultPayApp } from "@/hooks/useVaultPayApp";

export function AppShell() {
  const app = useVaultPayApp();

  if (!app.workspace) {
    return (
      <LoginGate
        displayName={app.displayName}
        setDisplayName={app.setDisplayName}
        agentName={app.agentName}
        setAgentName={app.setAgentName}
        agentRole={app.agentRole}
        setAgentRole={app.setAgentRole}
        agentPaymentMethod={app.agentPaymentMethod}
        setAgentPaymentMethod={app.setAgentPaymentMethod}
        mandateBudget={app.mandateBudget}
        setMandateBudget={app.setMandateBudget}
        perPurchaseLimit={app.perPurchaseLimit}
        setPerPurchaseLimit={app.setPerPurchaseLimit}
        approvalThreshold={app.approvalThreshold}
        setApprovalThreshold={app.setApprovalThreshold}
        enterApp={app.enterApp}
        busy={app.busy}
        status={app.status}
        statusTone={app.statusTone}
      />
    );
  }

  const meta = app.viewMeta[app.view];

  return (
    <div className="app-shell">
      <AppNavbar
        view={app.view}
        onViewChange={app.setView}
        onAssetOpen={app.setAssetModal}
        onRefresh={app.refresh}
        busy={app.busy}
        pendingApprovals={app.dashboard?.totals.pendingApprovals ?? 0}
      />

      <main className="app-main">
        <header className="page-header animate-fade-in-up">
          <h1 className="page-title">{meta.title}</h1>
          <p className="page-subtitle">{meta.subtitle}</p>
          <StatusBanner message={app.status} tone={app.statusTone} />
        </header>

        <div className="page-content animate-fade-in-up stagger-2">
          {app.view === "dashboard" && (
            <DashboardView
              dashboard={app.dashboard}
              latestAgent={app.latestAgent}
              latestMandate={app.latestMandate}
              latestApproval={app.latestApproval}
              candidates={app.candidates}
              paymentChoice={app.paymentChoice}
              setPaymentChoice={app.setPaymentChoice}
              runUseCase={app.runUseCase}
              onUseCaseChange={app.onUseCaseChange}
              objective={app.objective}
              setObjective={app.setObjective}
              useCases={app.useCases}
              runAgent={app.runAgent}
              approveLatest={app.approveLatest}
              rejectLatest={() => app.rejectLatest()}
              busy={app.busy}
            />
          )}
          {app.view === "vault" && (
            <VaultView
              workspace={app.workspace}
              card={app.card}
              wallet={app.wallet}
              mandates={app.dashboard?.mandates ?? []}
            />
          )}
          {app.view === "agents" && (
            <AgentsView agents={app.dashboard?.agents ?? []} onRevoke={app.revokeAgent} busy={app.busy} />
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

      <CreditCardModal
        open={app.assetModal === "card"}
        card={app.workspace.cardPreview}
        paymentMethod={app.card}
        onClose={() => app.setAssetModal(null)}
      />
      <WalletModal
        open={app.assetModal === "wallet"}
        wallet={app.workspace.walletPreview}
        paymentMethod={app.wallet}
        onClose={() => app.setAssetModal(null)}
      />
    </div>
  );
}
