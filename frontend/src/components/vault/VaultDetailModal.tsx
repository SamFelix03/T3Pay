"use client";

import type { AnyRow } from "@/lib/types";
import type { VaultFunding } from "@/lib/vault-funding";
import { fundingSlots } from "@/lib/vault-funding";
import { short } from "@/lib/format";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { VaultMiniCardPanel, VaultMiniWalletPanel } from "@/components/vault/VaultMiniAssets";

type Props = VaultFunding & {
  open: boolean;
  vaultId: string;
  label: string;
  displayName: string;
  agentCount: number;
  onClose: () => void;
};

export function VaultDetailModal({
  open,
  vaultId,
  label,
  displayName,
  card,
  wallet,
  agentCount,
  onClose
}: Props) {
  if (!open) return null;

  const slots = fundingSlots({ card, wallet });
  const layoutClass =
    slots.length === 2
      ? "vault-detail-layout--duo"
      : slots.length === 1
        ? "vault-detail-layout--solo"
        : "vault-detail-layout--empty";

  return (
    <ModalPortal>
      <div className="modal-overlay" onClick={onClose} role="presentation">
        <div
          className="modal-panel vault-detail-modal"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={`${label} details`}
        >
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>

          <header className="vault-detail-header">
            <h2 className="modal-title">{label}</h2>
            <p className="modal-lead">
              {short(vaultId)} · {agentCount} agent{agentCount === 1 ? "" : "s"}
            </p>
          </header>

          <div className={`vault-detail-layout ${layoutClass}`}>
            {card ? <VaultMiniCardPanel paymentMethod={card} displayName={displayName} /> : null}
            {wallet ? <VaultMiniWalletPanel paymentMethod={wallet} /> : null}
            {!slots.length ? (
              <p className="vault-funding-empty vault-detail-empty">This vault has no card or wallet attached yet.</p>
            ) : null}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
