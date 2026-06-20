import type { VaultPayApp } from "@/hooks/useVaultPayApp";
import { money } from "@/lib/format";
import { EmptyState, FieldRow, MetricTile, StatusChip } from "@/components/ui/primitives";

type Props = Pick<
  VaultPayApp,
  | "dashboard"
  | "latestAgent"
  | "latestMandate"
  | "latestApproval"
  | "candidates"
  | "paymentChoice"
  | "setPaymentChoice"
  | "runUseCase"
  | "onUseCaseChange"
  | "objective"
  | "setObjective"
  | "useCases"
  | "runAgent"
  | "approveLatest"
  | "rejectLatest"
  | "busy"
>;

export function DashboardView({
  dashboard,
  latestAgent,
  latestMandate,
  latestApproval,
  candidates,
  paymentChoice,
  setPaymentChoice,
  runUseCase,
  onUseCaseChange,
  objective,
  setObjective,
  useCases,
  runAgent,
  approveLatest,
  rejectLatest,
  busy
}: Props) {
  return (
    <div className="view-stack">
      <section className="metrics-row">
        <MetricTile label="Delegated" value={money(dashboard?.totals.delegatedBudgetCents ?? 0)} accent />
        <MetricTile label="Approvals" value={String(dashboard?.totals.pendingApprovals ?? 0)} />
        <MetricTile label="Blocked" value={String(dashboard?.totals.blockedAttempts ?? 0)} />
        <MetricTile label="Agents" value={String(dashboard?.totals.activeAgents ?? 0)} />
      </section>

      {latestApproval ? (
        <section className="surface-card approval-banner">
          <div>
            <span className="section-label">Needs approval</span>
            <strong>{String(latestApproval.reason ?? "Purchase request")}</strong>
          </div>
          <div className="inline-actions">
            <button type="button" className="primary-btn" onClick={approveLatest} disabled={busy}>Approve</button>
            <button type="button" className="ghost-btn" onClick={() => rejectLatest()} disabled={busy}>Reject</button>
          </div>
        </section>
      ) : null}

      <section className="surface-card agent-run-card">
        <div className="card-head">
          <div>
            <span className="section-label">Agent instruction</span>
            <h2>Run purchase</h2>
          </div>
          {latestAgent ? <StatusChip value={String(latestAgent.status)} /> : null}
        </div>

        <div className="composer-grid">
          <label>
            Category
            <select value={runUseCase} onChange={(event) => onUseCaseChange(event.target.value as typeof runUseCase)}>
              {useCases.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <label>
            Pay with
            <select value={paymentChoice} onChange={(event) => setPaymentChoice(event.target.value as typeof paymentChoice)}>
              <option value="card">Card</option>
              <option value="stablecoin">USDC</option>
            </select>
          </label>
          <label className="wide">
            Instruction
            <textarea value={objective} onChange={(event) => setObjective(event.target.value)} rows={2} />
          </label>
        </div>

        {candidates.length ? (
          <div className="candidate-row">
            {candidates.map((product) => (
              <span key={product.id}>{product.name} · {money(product.price_cents)}</span>
            ))}
          </div>
        ) : null}

        <div className="card-foot">
          <p>Groq picks from eligible products. T3N enforces mandate and never exposes credentials.</p>
          <button type="button" className="primary-btn" onClick={runAgent} disabled={busy || !latestAgent || !latestMandate}>
            Start agent
          </button>
        </div>
      </section>

      {latestAgent ? (
        <section className="surface-card compact-insight">
          <span className="section-label">Authority snapshot</span>
          <div className="insight-grid">
            <FieldRow label="Agent" value={String(latestAgent.name)} />
            <FieldRow label="Budget left" value={money(Number(latestMandate?.budget_remaining_cents ?? 0))} />
            <FieldRow label="Grant" value={((latestAgent.latestGrant as Record<string, unknown> | undefined)?.status as string) ?? "missing"} />
          </div>
        </section>
      ) : (
        <EmptyState text="Enter the app to create your vault and agent." />
      )}
    </div>
  );
}
