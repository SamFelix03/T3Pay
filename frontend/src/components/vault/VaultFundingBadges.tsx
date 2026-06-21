import type { AnyRow } from "@/lib/types";
import { money } from "@/lib/format";

type Props = {
  card: AnyRow | undefined;
  wallet: AnyRow | undefined;
  compact?: boolean;
};

export function VaultFundingBadges({ card, wallet, compact = false }: Props) {
  if (!card && !wallet) {
    return <span className="vault-funding-empty">No funding attached</span>;
  }

  return (
    <div className={`vault-funding-badges ${compact ? "compact" : ""}`}>
      {card ? (
        <span className="vault-funding-badge card">
          <span aria-hidden>💳</span>
          {String(card.alias ?? "Card")}
          {!compact ? ` · ${money(Number(card.balance_cents ?? 0))}` : null}
        </span>
      ) : null}
      {wallet ? (
        <span className="vault-funding-badge wallet">
          <span aria-hidden>👛</span>
          {String(wallet.alias ?? "Wallet")}
          {!compact ? ` · ${money(Number(wallet.balance_cents ?? 0))}` : null}
        </span>
      ) : null}
    </div>
  );
}
