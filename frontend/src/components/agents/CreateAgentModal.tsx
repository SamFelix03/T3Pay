"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { AgentPaymentMethod, AgentRole, AnyRow, CreateAgentInput } from "@/lib/types";
import { getVaultLabel } from "@/lib/asset-previews";
import { fundingForVault } from "@/lib/vault-funding";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { SelectMenu, type SelectOption } from "@/components/ui/SelectMenu";
import { VaultGridCard } from "@/components/vault/VaultGridCard";

type Props = {
  open: boolean;
  vaults: AnyRow[];
  paymentMethods: AnyRow[];
  busy: boolean;
  onClose: () => void;
  onCreate: (input: CreateAgentInput) => void;
};

const STAGES = [
  { id: 1, label: "Name" },
  { id: 2, label: "Role" },
  { id: 3, label: "Vault" },
  { id: 4, label: "Budget" }
] as const;

const ROLE_OPTIONS: Array<{ value: AgentRole; label: string }> = [
  { value: "shopping_agent", label: "Shopping Agent" },
  { value: "travel_agent", label: "Travel Agent" },
  { value: "subscription_agent", label: "Subscription Agent" },
  { value: "research_only", label: "Research Only" },
  { value: "custom_agent", label: "Custom Agent" }
];

type StageId = (typeof STAGES)[number]["id"];

function paymentOptionsForVault(methods: AnyRow[]): SelectOption[] {
  const hasCard = methods.some((method) => method.type === "card");
  const hasWallet = methods.some((method) => method.type === "stablecoin");
  const options: SelectOption[] = [];
  if (hasCard && hasWallet) options.push({ value: "both", label: "Card and USDC" });
  if (hasCard) options.push({ value: "card", label: "Card only" });
  if (hasWallet) options.push({ value: "stablecoin", label: "USDC only" });
  return options;
}

function defaultPaymentMethod(options: SelectOption[]): AgentPaymentMethod {
  const first = options[0]?.value;
  if (first === "card" || first === "stablecoin" || first === "both") return first;
  return "card";
}

export function CreateAgentModal({ open, vaults, paymentMethods, busy, onClose, onCreate }: Props) {
  const [stage, setStage] = useState<StageId>(1);
  const [name, setName] = useState("");
  const [role, setRole] = useState<AgentRole>("shopping_agent");
  const [vaultId, setVaultId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<AgentPaymentMethod>("both");
  const [budget, setBudget] = useState(500);
  const [perPurchase, setPerPurchase] = useState(150);
  const [approvalThreshold, setApprovalThreshold] = useState(100);
  const stageBodyRef = useRef<HTMLDivElement>(null);
  const [stageBodyHeight, setStageBodyHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setStage(1);
    setName("");
    setRole("shopping_agent");
    setVaultId(vaults[0]?.id ? String(vaults[0].id) : "");
    setPaymentMethod("both");
    setBudget(500);
    setPerPurchase(150);
    setApprovalThreshold(100);
  }, [open, vaults]);

  const vaultMethods = useMemo(
    () => paymentMethods.filter((method) => String(method.vault_id) === vaultId),
    [paymentMethods, vaultId]
  );
  const paymentOptions = useMemo(() => paymentOptionsForVault(vaultMethods), [vaultMethods]);
  const hasFunding = vaultMethods.some((method) => method.type === "card" || method.type === "stablecoin");
  const paymentReady = paymentOptions.some((option) => option.value === paymentMethod);

  useLayoutEffect(() => {
    if (!open) {
      setStageBodyHeight(null);
      return;
    }

    const node = stageBodyRef.current;
    if (!node) return;

    const measure = () => setStageBodyHeight(node.getBoundingClientRect().height);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [open, stage, vaults.length, paymentOptions.length, hasFunding]);

  useEffect(() => {
    if (!vaultId || !paymentOptions.length) return;
    if (!paymentReady) setPaymentMethod(defaultPaymentMethod(paymentOptions));
  }, [vaultId, paymentOptions, paymentReady]);

  if (!open) return null;

  const progress = ((stage - 1) / STAGES.length) * 100;
  const isCompact = stage === 1;
  const canAdvanceStage1 = name.trim().length > 0;
  const canAdvanceStage3 = Boolean(vaultId) && hasFunding && paymentReady;
  const canSubmit =
    canAdvanceStage1 &&
    canAdvanceStage3 &&
    budget > 0 &&
    perPurchase > 0 &&
    approvalThreshold >= 0;

  function goBack() {
    setStage((current) => (current > 1 ? ((current - 1) as StageId) : current));
  }

  function goNext() {
    if (stage === 1 && !canAdvanceStage1) return;
    if (stage === 3 && !canAdvanceStage3) return;
    setStage((current) => (current < 4 ? ((current + 1) as StageId) : current));
  }

  function handleSubmit() {
    if (!canSubmit || !vaultId) return;
    onCreate({
      name: name.trim(),
      role,
      paymentMethod,
      vaultId,
      budgetCents: Math.round(budget * 100),
      perPurchaseLimitCents: Math.round(perPurchase * 100),
      approvalThresholdCents: Math.round(approvalThreshold * 100)
    });
  }

  return (
    <ModalPortal>
      <div className="modal-overlay" onClick={onClose} role="presentation">
        <div
          className={`modal-panel create-agent-modal ${isCompact ? "create-agent-modal--compact" : "create-agent-modal--wide"}`}
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Create agent"
        >
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>

          <div className="wizard-progress" aria-hidden>
            <div className="wizard-progress-track">
              <div className="wizard-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="wizard-progress-labels">
              {STAGES.map((item) => (
                <span
                  key={item.id}
                  className={stage === item.id ? "active" : stage > item.id ? "complete" : ""}
                >
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          <div
            className="create-agent-modal-body"
            style={stageBodyHeight === null ? undefined : { height: stageBodyHeight }}
          >
            <div ref={stageBodyRef}>
              {stage === 1 ? (
                <section className="wizard-stage wizard-stage--centered">
                  <h2 className="wizard-stage-title">Name your agent</h2>
                  <label className="wizard-name-field">
                    <span className="sr-only">Agent name</span>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Shopping Agent"
                      autoFocus
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && canAdvanceStage1) goNext();
                      }}
                    />
                  </label>
                  <button type="button" className="primary-btn wizard-primary-action" onClick={goNext} disabled={!canAdvanceStage1 || busy}>
                    Next
                  </button>
                </section>
              ) : null}

              {stage === 2 ? (
                <section className="wizard-stage">
                  <h2 className="wizard-stage-title">Choose its role</h2>
                  <p className="wizard-stage-lead">Pick the policy profile that best matches how this agent should spend.</p>
                  <div className="wizard-role-chips" role="listbox" aria-label="Agent role">
                    {ROLE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={role === option.value}
                        className={`wizard-role-chip ${role === option.value ? "active" : ""}`}
                        onClick={() => setRole(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="wizard-nav-row">
                    <button type="button" className="ghost-btn" onClick={goBack} disabled={busy}>
                      Back
                    </button>
                    <button type="button" className="primary-btn" onClick={goNext} disabled={busy}>
                      Next
                    </button>
                  </div>
                </section>
              ) : null}

              {stage === 3 ? (
                <section className="wizard-stage">
                  <h2 className="wizard-stage-title">Select vault</h2>
                  <p className="wizard-stage-lead">Choose the vault this agent spends from, then pick allowed payment methods.</p>

                  {!vaults.length ? (
                    <p className="field-hint">Create a vault first before adding an agent.</p>
                  ) : (
                    <>
                      <div className="create-agent-vault-grid" role="radiogroup" aria-label="Vault selection">
                        {vaults.map((vault) => {
                          const id = String(vault.id);
                          const funding = fundingForVault(paymentMethods, id);
                          return (
                            <VaultGridCard
                              key={id}
                              vaultId={id}
                              label={getVaultLabel(id)}
                              card={funding.card}
                              wallet={funding.wallet}
                              selected={vaultId === id}
                              onClick={() => setVaultId(id)}
                            />
                          );
                        })}
                      </div>

                      <label className="wizard-field">
                        Payment methods
                        <SelectMenu
                          value={paymentMethod}
                          options={paymentOptions.length ? paymentOptions : [{ value: "", label: "No methods in vault", disabled: true }]}
                          onChange={(value) => setPaymentMethod(value as AgentPaymentMethod)}
                        />
                      </label>
                      {!hasFunding ? (
                        <p className="field-hint">Selected vault needs at least one card or wallet attached.</p>
                      ) : null}
                    </>
                  )}

                  <div className="wizard-nav-row">
                    <button type="button" className="ghost-btn" onClick={goBack} disabled={busy}>
                      Back
                    </button>
                    <button type="button" className="primary-btn" onClick={goNext} disabled={!canAdvanceStage3 || busy}>
                      Next
                    </button>
                  </div>
                </section>
              ) : null}

              {stage === 4 ? (
                <section className="wizard-stage">
                  <h2 className="wizard-stage-title">Set spending limits</h2>
                  <p className="wizard-stage-lead">Define how much this agent can spend and when you need to approve.</p>

                  <div className="wizard-budget-fields">
                    <label className="wizard-budget-field">
                      <span>Total budget ($)</span>
                      <input type="number" min={1} value={budget} onChange={(event) => setBudget(Number(event.target.value))} />
                      <small>Maximum amount this agent can spend across all purchases in this mandate.</small>
                    </label>

                    <label className="wizard-budget-field">
                      <span>Per purchase limit ($)</span>
                      <input type="number" min={1} value={perPurchase} onChange={(event) => setPerPurchase(Number(event.target.value))} />
                      <small>Cap for any single checkout attempt.</small>
                    </label>

                    <label className="wizard-budget-field">
                      <span>Auto-approve below ($)</span>
                      <input
                        type="number"
                        min={0}
                        value={approvalThreshold}
                        onChange={(event) => setApprovalThreshold(Number(event.target.value))}
                      />
                      <small>Purchases above this amount require your manual approval first.</small>
                    </label>
                  </div>

                  <div className="wizard-nav-row">
                    <button type="button" className="ghost-btn" onClick={goBack} disabled={busy}>
                      Back
                    </button>
                    <button type="button" className="primary-btn" onClick={handleSubmit} disabled={!canSubmit || busy}>
                      {busy ? "Creating…" : "Create agent"}
                    </button>
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
