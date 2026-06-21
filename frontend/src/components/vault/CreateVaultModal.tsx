"use client";

import { useState } from "react";
import type { AnyRow, CreateVaultInput } from "@/lib/types";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { money } from "@/lib/format";

type Props = {
  open: boolean;
  cards: AnyRow[];
  wallets: AnyRow[];
  busy: boolean;
  onClose: () => void;
  onCreate: (input: CreateVaultInput) => void;
};

const MODE_OPTIONS = [
  { value: "new", label: "Create new" },
  { value: "existing", label: "Use existing" },
  { value: "none", label: "Skip" }
];

export function CreateVaultModal({ open, cards, wallets, busy, onClose, onCreate }: Props) {
  const [label, setLabel] = useState("");
  const [cardMode, setCardMode] = useState<CreateVaultInput["cardMode"]>("new");
  const [walletMode, setWalletMode] = useState<CreateVaultInput["walletMode"]>("new");
  const [existingCardId, setExistingCardId] = useState(cards[0]?.id ? String(cards[0].id) : "");
  const [existingWalletId, setExistingWalletId] = useState(wallets[0]?.id ? String(wallets[0].id) : "");

  if (!open) return null;

  const canSubmit =
    (cardMode === "none" || cardMode === "new" || (cardMode === "existing" && existingCardId)) &&
    (walletMode === "none" || walletMode === "new" || (walletMode === "existing" && existingWalletId)) &&
    (cardMode !== "none" || walletMode !== "none");

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal-panel form-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 className="modal-title">Create vault</h2>
        <p className="modal-lead">Seal a card and/or wallet together. You can create multiple vaults per user.</p>

        <div className="modal-fields">
          <label>
            Vault name
            <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Travel vault" />
          </label>

          <label>
            Card
            <SelectMenu value={cardMode} options={MODE_OPTIONS} onChange={(value) => setCardMode(value as CreateVaultInput["cardMode"])} />
          </label>
          {cardMode === "existing" ? (
            <label>
              Select card
              <SelectMenu
                value={existingCardId}
                options={cards.map((card) => ({
                  value: String(card.id),
                  label: `${String(card.alias ?? card.display ?? "Card")} · ${money(Number(card.balance_cents ?? 0))}`
                }))}
                onChange={setExistingCardId}
              />
            </label>
          ) : null}

          <label>
            Wallet
            <SelectMenu value={walletMode} options={MODE_OPTIONS} onChange={(value) => setWalletMode(value as CreateVaultInput["walletMode"])} />
          </label>
          {walletMode === "existing" ? (
            <label>
              Select wallet
              <SelectMenu
                value={existingWalletId}
                options={wallets.map((wallet) => ({
                  value: String(wallet.id),
                  label: `${String(wallet.alias ?? wallet.display ?? "Wallet")} · ${money(Number(wallet.balance_cents ?? 0))}`
                }))}
                onChange={setExistingWalletId}
              />
            </label>
          ) : null}
        </div>

        <div className="modal-actions">
          <button type="button" className="ghost-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-btn"
            disabled={!canSubmit || busy}
            onClick={() =>
              onCreate({
                label,
                cardMode,
                walletMode,
                existingCardId: cardMode === "existing" ? existingCardId : undefined,
                existingWalletId: walletMode === "existing" ? existingWalletId : undefined
              })
            }
          >
            {busy ? "Creating…" : "Create vault"}
          </button>
        </div>
      </div>
    </div>
  );
}
