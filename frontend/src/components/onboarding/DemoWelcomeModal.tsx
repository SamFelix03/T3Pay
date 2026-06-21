"use client";

import { money } from "@/lib/format";

type Props = {
  open: boolean;
  displayName: string;
  cardBalanceCents: number;
  walletBalanceCents: number;
  onViewCard: () => void;
  onViewWallet: () => void;
  onClose: () => void;
};

export function DemoWelcomeModal({
  open,
  displayName,
  cardBalanceCents,
  walletBalanceCents,
  onViewCard,
  onViewWallet,
  onClose
}: Props) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal-panel form-modal demo-welcome-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 className="modal-title">Your demo wallet is ready</h2>
        <p className="modal-lead">
          Welcome, {displayName}. We created <strong>T3Pay Vault</strong> with a mock card and USDC wallet so you can
          explore VaultPay immediately — no setup required.
        </p>

        <div className="demo-welcome-grid">
          <article className="demo-welcome-item">
            <span className="demo-welcome-icon">💳</span>
            <strong>Demo card</strong>
            <p>T3Pay Visa with {money(cardBalanceCents)} demo balance. View sealed credentials from the header Card button.</p>
          </article>
          <article className="demo-welcome-item">
            <span className="demo-welcome-icon">👛</span>
            <strong>Demo USDC wallet</strong>
            <p>Mock stablecoin wallet with {money(walletBalanceCents)}. Agents never see raw keys — only policy-safe context.</p>
          </article>
        </div>

        <p className="field-hint">
          These live in your first vault. Create more vaults, cards, and wallets anytime from the dashboard or header.
        </p>

        <div className="modal-actions demo-welcome-actions">
          <button type="button" className="ghost-btn" onClick={onViewCard}>
            View card
          </button>
          <button type="button" className="ghost-btn" onClick={onViewWallet}>
            View wallet
          </button>
          <button type="button" className="primary-btn" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
