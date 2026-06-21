"use client";

import type { AnyRow, MockCard, MockWallet } from "@/lib/types";
import { balanceCents, formatCardLabel, formatWalletLabel } from "@/lib/vault-funding";
import { money } from "@/lib/format";
import { resolveCardPreview, resolveWalletPreview } from "@/components/vault/AssetModals";

type CardPanelProps = {
  paymentMethod: AnyRow;
  displayName: string;
};

export function VaultMiniCardPanel({ paymentMethod, displayName }: CardPanelProps) {
  const preview = resolveCardPreview(paymentMethod, displayName);

  return (
    <div className="vault-detail-panel">
      <MiniCreditCard card={preview} />
      <div className="vault-detail-panel-copy">
        <strong>{formatCardLabel(paymentMethod)}</strong>
        <span>{money(balanceCents(paymentMethod))}</span>
      </div>
    </div>
  );
}

type WalletPanelProps = {
  paymentMethod: AnyRow;
};

export function VaultMiniWalletPanel({ paymentMethod }: WalletPanelProps) {
  const preview = resolveWalletPreview(paymentMethod);

  return (
    <div className="vault-detail-panel">
      <MiniWallet wallet={preview} />
      <div className="vault-detail-panel-copy">
        <strong>{formatWalletLabel(paymentMethod)}</strong>
        <span>{money(balanceCents(paymentMethod))}</span>
      </div>
    </div>
  );
}

function MiniCreditCard({ card }: { card: MockCard }) {
  return (
    <div className="credit-card-visual credit-card-visual--mini" aria-hidden>
      <div className="credit-card-chip" />
      <div className="credit-card-network">{card.network}</div>
      <div className="credit-card-number">{card.number}</div>
      <div className="credit-card-meta">
        <div>
          <span>Expires</span>
          <strong>{card.expiry}</strong>
        </div>
      </div>
    </div>
  );
}

function MiniWallet({ wallet }: { wallet: MockWallet }) {
  return (
    <div className="wallet-visual wallet-visual--mini" aria-hidden>
      <div className="wallet-icon-ring">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
          <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
        </svg>
      </div>
      <span className="wallet-symbol">{wallet.symbol}</span>
      <code className="wallet-address">{wallet.address}</code>
    </div>
  );
}
