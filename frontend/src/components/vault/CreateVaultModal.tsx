"use client";

import { useEffect, useState } from "react";
import type { AnyRow, CreateVaultInput } from "@/lib/types";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { VaultFundingSelectorPanel } from "@/components/vault/VaultFundingSelectorPanel";

type Props = {
  open: boolean;
  cards: AnyRow[];
  wallets: AnyRow[];
  displayName: string;
  busy: boolean;
  onClose: () => void;
  onCreate: (input: CreateVaultInput) => void;
};

export function CreateVaultModal({ open, cards, wallets, displayName, busy, onClose, onCreate }: Props) {
  const [label, setLabel] = useState("");
  const [cardId, setCardId] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLabel("");
    setCardId(null);
    setWalletId(null);
  }, [open]);

  if (!open) return null;

  return (
    <ModalPortal>
      <div className="modal-overlay" onClick={onClose} role="presentation">
        <div
          className="modal-panel vault-detail-modal vault-create-modal"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>

          <header className="vault-detail-header">
            <h2 className="modal-title">Create vault</h2>
            <p className="modal-lead">Choose existing funding to seal in this vault, or skip either side.</p>
          </header>

          <label className="vault-create-name-field">
            Vault name
            <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Travel vault" />
          </label>

          <div className="vault-detail-layout vault-detail-layout--duo">
            <VaultFundingSelectorPanel
              kind="card"
              items={cards}
              selectedId={cardId}
              displayName={displayName}
              onSelect={setCardId}
            />
            <VaultFundingSelectorPanel
              kind="wallet"
              items={wallets}
              selectedId={walletId}
              displayName={displayName}
              onSelect={setWalletId}
            />
          </div>

          <div className="modal-actions vault-create-actions">
            <button type="button" className="ghost-btn" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="primary-btn"
              disabled={busy}
              onClick={() =>
                onCreate({
                  label,
                  cardId: cardId ?? undefined,
                  walletId: walletId ?? undefined
                })
              }
            >
              {busy ? "Creating…" : "Create vault"}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
