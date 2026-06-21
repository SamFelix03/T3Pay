"use client";

import type { AnyRow, MockCard, MockWallet } from "@/lib/types";
import { money } from "@/lib/format";
import { CreditCardModal, resolveCardPreview, resolveWalletPreview, WalletModal } from "@/components/vault/AssetModals";

type Props = {
  open: boolean;
  kind: "card" | "wallet";
  items: AnyRow[];
  selectedId: string | null;
  displayName: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onClose: () => void;
  busy: boolean;
};

function CardThumb({ card }: { card: MockCard }) {
  return (
    <div className="asset-thumb-card" aria-hidden>
      <div className="asset-thumb-chip" />
      <span className="asset-thumb-network">{card.network}</span>
      <span className="asset-thumb-digits">{card.number.slice(-4)}</span>
    </div>
  );
}

function WalletThumb({ wallet }: { wallet: MockWallet }) {
  return (
    <div className="asset-thumb-wallet" aria-hidden>
      <span className="asset-thumb-symbol">{wallet.symbol}</span>
      <code>{wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}</code>
    </div>
  );
}

export function AssetHubModal({
  open,
  kind,
  items,
  selectedId,
  displayName,
  onSelect,
  onAdd,
  onClose,
  busy
}: Props) {
  if (!open) return null;

  const activeId = selectedId ?? (items[0] ? String(items[0].id) : null);
  const activeItem = items.find((item) => String(item.id) === activeId) ?? null;
  const title = kind === "card" ? "Your cards" : "Your wallets";
  const addLabel = kind === "card" ? "Add card" : "Add wallet";

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-panel asset-hub-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <header className="asset-hub-header">
          <div>
            <h2 className="modal-title">{title}</h2>
            <p className="modal-lead">
              Browse sealed credentials, switch between funding sources, or add another demo {kind}.
            </p>
          </div>
          <button type="button" className="primary-btn" onClick={onAdd} disabled={busy}>
            {addLabel}
          </button>
        </header>

        <div className="asset-hub-layout">
          <aside className="asset-hub-list">
            {items.length ? (
              items.map((item) => {
                const id = String(item.id);
                const isActive = id === activeId;
                const preview =
                  kind === "card"
                    ? resolveCardPreview(item, displayName)
                    : resolveWalletPreview(item);
                return (
                  <button
                    key={id}
                    type="button"
                    className={`asset-hub-item ${isActive ? "active" : ""}`}
                    onClick={() => onSelect(id)}
                  >
                    {kind === "card" ? <CardThumb card={preview as MockCard} /> : <WalletThumb wallet={preview as MockWallet} />}
                    <div className="asset-hub-item-copy">
                      <strong>{String(item.alias ?? item.display ?? (kind === "card" ? "Card" : "Wallet"))}</strong>
                      <span>{money(Number(item.balance_cents ?? 0))}</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="asset-hub-empty">
                <p>No {kind === "card" ? "cards" : "wallets"} yet.</p>
                <button type="button" className="ghost-btn" onClick={onAdd} disabled={busy}>
                  {addLabel}
                </button>
              </div>
            )}
          </aside>

          <div className="asset-hub-detail">
            {activeItem ? (
              kind === "card" ? (
                <InlineCardDetail
                  card={resolveCardPreview(activeItem, displayName)}
                  paymentMethod={activeItem}
                />
              ) : (
                <InlineWalletDetail
                  wallet={resolveWalletPreview(activeItem)}
                  paymentMethod={activeItem}
                />
              )
            ) : (
              <div className="asset-hub-empty-detail">
                <p>Add a demo {kind} to view sealed credentials here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InlineCardDetail({ card, paymentMethod }: { card: MockCard; paymentMethod: AnyRow }) {
  return (
    <div className="asset-inline-detail">
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
          {paymentMethod.display ? String(paymentMethod.display) : "Demo card"} · {money(Number(paymentMethod.balance_cents ?? 0))}
        </strong>
      </div>
    </div>
  );
}

function InlineWalletDetail({ wallet, paymentMethod }: { wallet: MockWallet; paymentMethod: AnyRow }) {
  return (
    <div className="asset-inline-detail">
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
        <strong>{money(Number(paymentMethod.balance_cents ?? 0))}</strong>
      </div>
    </div>
  );
}

// Keep legacy single-item modals available for demo welcome shortcuts.
export { CreditCardModal, WalletModal, resolveCardPreview, resolveWalletPreview } from "@/components/vault/AssetModals";
