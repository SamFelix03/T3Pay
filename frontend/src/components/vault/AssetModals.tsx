"use client";

import type { AnyRow, AssetModal, MockCard, MockWallet } from "@/lib/types";
import { getAssetPreview } from "@/lib/asset-previews";
import { money } from "@/lib/format";
import { createMockCard, createMockWallet } from "@/lib/mock-assets";

type PickerProps = {
  open: boolean;
  kind: "card" | "wallet";
  items: AnyRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onClose: () => void;
  busy: boolean;
};

export function AssetPickerModal({ open, kind, items, selectedId, onSelect, onAdd, onClose, busy }: PickerProps) {
  if (!open) return null;

  const title = kind === "card" ? "Your cards" : "Your wallets";

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal-panel form-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 className="modal-title">{title}</h2>
        <p className="modal-lead">Select one to view sealed credentials, or add another demo {kind}.</p>

        <div className="asset-picker-list">
          {items.map((item) => (
            <button
              key={String(item.id)}
              type="button"
              className={`asset-picker-item ${selectedId === String(item.id) ? "active" : ""}`}
              onClick={() => onSelect(String(item.id))}
            >
              <span>{String(item.alias ?? item.display ?? (kind === "card" ? "Card" : "Wallet"))}</span>
              <strong>{money(Number(item.balance_cents ?? 0))}</strong>
            </button>
          ))}
          {!items.length ? <p className="empty-state">No {kind === "card" ? "cards" : "wallets"} yet.</p> : null}
        </div>

        <div className="modal-actions">
          <button type="button" className="ghost-btn" onClick={onClose}>
            Close
          </button>
          <button type="button" className="primary-btn" onClick={onAdd} disabled={busy}>
            Add new {kind === "card" ? "card" : "wallet"}
          </button>
        </div>
      </div>
    </div>
  );
}

type Props = {
  open: boolean;
  card: MockCard;
  paymentMethod: AnyRow | null;
  onClose: () => void;
};

export function CreditCardModal({ open, card, paymentMethod, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal-panel card-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="VaultPay card">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="credit-card-visual">
          <div className="credit-card-chip" />
          <div className="credit-card-network">{card.network}</div>
          <div className="credit-card-number">{card.number}</div>
          <div className="credit-card-meta">
            <div>
              <span>Cardholder</span>
              <strong>{card.holder}</strong>
            </div>
            <div>
              <span>Expires</span>
              <strong>{card.expiry}</strong>
            </div>
            <div>
              <span>CVC</span>
              <strong>{card.cvc}</strong>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <span>Sealed in T3N · not visible to agents</span>
          <strong>
            {paymentMethod?.display ? String(paymentMethod.display) : "Demo card"} · {money(Number(paymentMethod?.balance_cents ?? 0))}
          </strong>
        </div>
      </div>
    </div>
  );
}

type WalletProps = {
  open: boolean;
  wallet: MockWallet;
  paymentMethod: AnyRow | null;
  onClose: () => void;
};

export function WalletModal({ open, wallet, paymentMethod, onClose }: WalletProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal-panel wallet-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="VaultPay wallet">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="wallet-visual">
          <div className="wallet-icon-ring">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
              <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
            </svg>
          </div>
          <span className="wallet-symbol">{wallet.symbol}</span>
          <code className="wallet-address">{wallet.address}</code>
          <p>Demo stablecoin wallet · credentials sealed in T3N</p>
        </div>
        <div className="modal-footer">
          <span>Available balance</span>
          <strong>{money(Number(paymentMethod?.balance_cents ?? 0))}</strong>
        </div>
      </div>
    </div>
  );
}

export function resolveCardPreview(paymentMethod: AnyRow | null, displayName: string): MockCard {
  if (paymentMethod?.id) {
    const preview = getAssetPreview(String(paymentMethod.id));
    if (preview?.type === "card") return preview.card;
  }
  return createMockCard(displayName);
}

export function resolveWalletPreview(paymentMethod: AnyRow | null): MockWallet {
  if (paymentMethod?.id) {
    const preview = getAssetPreview(String(paymentMethod.id));
    if (preview?.type === "stablecoin") return preview.wallet;
  }
  return createMockWallet();
}

export type AssetFlowState = {
  picker: AssetModal;
  setPicker: (value: AssetModal) => void;
};
