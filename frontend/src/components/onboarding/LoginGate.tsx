"use client";

import { useState } from "react";
import type { VaultPayApp } from "@/hooks/useVaultPayApp";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { StatusBanner } from "@/components/ui/primitives";

type Props = Pick<
  VaultPayApp,
  | "displayName"
  | "setDisplayName"
  | "agentName"
  | "setAgentName"
  | "agentRole"
  | "setAgentRole"
  | "agentPaymentMethod"
  | "setAgentPaymentMethod"
  | "mandateBudget"
  | "setMandateBudget"
  | "perPurchaseLimit"
  | "setPerPurchaseLimit"
  | "approvalThreshold"
  | "setApprovalThreshold"
  | "enterApp"
  | "busy"
  | "status"
  | "statusTone"
>;

const ROLES = [
  { value: "shopping_agent", label: "Shopping Agent" },
  { value: "travel_agent", label: "Travel Agent" },
  { value: "subscription_agent", label: "Subscription Agent" },
  { value: "research_only", label: "Research Only" },
  { value: "custom_agent", label: "Custom Agent" }
] as const;

export function LoginGate({
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
  enterApp,
  busy,
  status,
  statusTone
}: Props) {
  const [step, setStep] = useState<1 | 2>(1);

  const canContinue = displayName.trim().length > 0;
  const canEnter = agentName.trim().length > 0;

  return (
    <main className="login-shell">
      <section className="login-card animate-scale-in">
        <div className="login-logo-wrap">
          <BrandLogo variant="hero" />
        </div>

        {step === 1 ? (
          <>
            <h1 className="login-question">Your Name</h1>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Enter your name"
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter" && canContinue) setStep(2);
              }}
            />
            <button type="button" className="primary-btn full" onClick={() => setStep(2)} disabled={!canContinue || busy}>
              Next
            </button>
          </>
        ) : (
          <>
            <button type="button" className="text-btn back-btn" onClick={() => setStep(1)} disabled={busy}>
              ← Back
            </button>
            <h1 className="login-question">Configure Your First Agent</h1>
            <p className="login-lead">Set how your agent spends and what it can access.</p>

            <div className="onboarding-fields">
              <label>
                Agent name
                <input
                  value={agentName}
                  onChange={(event) => setAgentName(event.target.value)}
                  placeholder="Shopping Agent"
                />
              </label>
              <label>
                Role
                <select value={agentRole} onChange={(event) => setAgentRole(event.target.value as typeof agentRole)}>
                  {ROLES.map((role) => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Payment methods
                <select
                  value={agentPaymentMethod}
                  onChange={(event) => setAgentPaymentMethod(event.target.value as typeof agentPaymentMethod)}
                >
                  <option value="both">Card and USDC</option>
                  <option value="card">Card only</option>
                  <option value="stablecoin">USDC only</option>
                </select>
              </label>
              <div className="onboarding-row">
                <label>
                  Budget ($)
                  <input
                    type="number"
                    min={1}
                    value={mandateBudget}
                    onChange={(event) => setMandateBudget(Number(event.target.value))}
                  />
                </label>
                <label>
                  Per purchase ($)
                  <input
                    type="number"
                    min={1}
                    value={perPurchaseLimit}
                    onChange={(event) => setPerPurchaseLimit(Number(event.target.value))}
                  />
                </label>
                <label>
                  Approval above ($)
                  <input
                    type="number"
                    min={1}
                    value={approvalThreshold}
                    onChange={(event) => setApprovalThreshold(Number(event.target.value))}
                  />
                </label>
              </div>
            </div>

            <button type="button" className="primary-btn full" onClick={enterApp} disabled={!canEnter || busy}>
              {busy ? "Creating vault…" : "Enter app"}
            </button>
          </>
        )}

        <StatusBanner message={status} tone={statusTone} />
      </section>
    </main>
  );
}
