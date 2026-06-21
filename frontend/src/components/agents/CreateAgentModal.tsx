"use client";

import { useState } from "react";
import type { AgentRole, AnyRow, CreateAgentInput, AgentPaymentMethod } from "@/lib/types";
import { getVaultLabel } from "@/lib/asset-previews";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { short } from "@/lib/format";

type Props = {
  open: boolean;
  vaults: AnyRow[];
  paymentMethods: AnyRow[];
  busy: boolean;
  onClose: () => void;
  onCreate: (input: CreateAgentInput) => void;
};

const ROLE_OPTIONS = [
  { value: "shopping_agent", label: "Shopping Agent" },
  { value: "travel_agent", label: "Travel Agent" },
  { value: "subscription_agent", label: "Subscription Agent" },
  { value: "research_only", label: "Research Only" },
  { value: "custom_agent", label: "Custom Agent" }
];

const PAYMENT_OPTIONS = [
  { value: "both", label: "Card and USDC" },
  { value: "card", label: "Card only" },
  { value: "stablecoin", label: "USDC only" }
];

export function CreateAgentModal({ open, vaults, paymentMethods, busy, onClose, onCreate }: Props) {
  const [name, setName] = useState("Shopping Agent");
  const [role, setRole] = useState<AgentRole>("shopping_agent");
  const [paymentMethod, setPaymentMethod] = useState<AgentPaymentMethod>("both");
  const [vaultId, setVaultId] = useState(vaults[0]?.id ? String(vaults[0].id) : "");
  const [budget, setBudget] = useState(500);
  const [perPurchase, setPerPurchase] = useState(150);
  const [approvalThreshold, setApprovalThreshold] = useState(100);

  if (!open) return null;

  const vaultMethods = paymentMethods.filter((method) => String(method.vault_id) === vaultId);
  const hasCard = vaultMethods.some((method) => method.type === "card");
  const hasWallet = vaultMethods.some((method) => method.type === "stablecoin");
  const vaultReady = vaultId && (hasCard || hasWallet);
  const paymentReady =
    paymentMethod === "card"
      ? hasCard
      : paymentMethod === "stablecoin"
        ? hasWallet
        : hasCard && hasWallet;

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal-panel form-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 className="modal-title">Create agent</h2>
        <p className="modal-lead">Configure spending policy and bind the agent to a vault.</p>

        <div className="modal-fields">
          <label>
            Agent name
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Role
            <SelectMenu value={role} options={ROLE_OPTIONS} onChange={(value) => setRole(value as AgentRole)} />
          </label>
          <label>
            Vault
            <SelectMenu
              value={vaultId}
              options={vaults.map((vault) => ({
                value: String(vault.id),
                label: getVaultLabel(String(vault.id))
              }))}
              onChange={setVaultId}
            />
          </label>
          {!vaultReady ? <p className="field-hint">Selected vault needs at least one card or wallet.</p> : null}
          <label>
            Payment methods
            <SelectMenu
              value={paymentMethod}
              options={PAYMENT_OPTIONS}
              onChange={(value) => setPaymentMethod(value as AgentPaymentMethod)}
            />
          </label>
          <div className="onboarding-row">
            <label>
              Budget ($)
              <input type="number" min={1} value={budget} onChange={(event) => setBudget(Number(event.target.value))} />
            </label>
            <label>
              Per purchase ($)
              <input type="number" min={1} value={perPurchase} onChange={(event) => setPerPurchase(Number(event.target.value))} />
            </label>
            <label>
              Approval above ($)
              <input type="number" min={0} value={approvalThreshold} onChange={(event) => setApprovalThreshold(Number(event.target.value))} />
            </label>
          </div>
          <p className="field-hint">Vault {short(vaultId)} · T3N ADK grant created on submit.</p>
        </div>

        <div className="modal-actions">
          <button type="button" className="ghost-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-btn"
            disabled={!name.trim() || !vaultReady || !paymentReady || busy}
            onClick={() =>
              onCreate({
                name: name.trim(),
                role,
                paymentMethod,
                vaultId,
                budgetCents: budget * 100,
                perPurchaseLimitCents: perPurchase * 100,
                approvalThresholdCents: approvalThreshold * 100
              })
            }
          >
            {busy ? "Creating…" : "Create agent"}
          </button>
        </div>
      </div>
    </div>
  );
}
