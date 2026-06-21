"use client";

import type { AnyRow } from "@/lib/types";
import { balanceCents, formatCardLabel, formatWalletLabel, fundingSlots, type VaultFunding } from "@/lib/vault-funding";
import { money } from "@/lib/format";
import { CreditCard, Wallet } from "lucide-react";

type Props = VaultFunding & {
  className?: string;
};

function FundingTile({
  kind,
  label,
  amountCents
}: {
  kind: "card" | "wallet";
  label: string;
  amountCents: number;
}) {
  const Icon = kind === "card" ? CreditCard : Wallet;

  return (
    <div className="vault-funding-tile" data-kind={kind}>
      <Icon className="vault-funding-tile-icon" strokeWidth={1.75} aria-hidden />
      <span className="vault-funding-tile-label">{label}</span>
      <strong className="vault-funding-tile-balance">{money(amountCents)}</strong>
    </div>
  );
}

export function VaultFundingGrid({ card, wallet, className = "" }: Props) {
  const slots = fundingSlots({ card, wallet });

  if (!slots.length) {
    return (
      <div className={`vault-funding-grid vault-funding-grid--empty ${className}`.trim()}>
        <p className="vault-funding-empty">No funding attached</p>
      </div>
    );
  }

  return (
    <div
      className={`vault-funding-grid ${slots.length === 1 ? "vault-funding-grid--solo" : "vault-funding-grid--duo"} ${className}`.trim()}
    >
      {card ? (
        <FundingTile kind="card" label={formatCardLabel(card)} amountCents={balanceCents(card)} />
      ) : null}
      {wallet ? (
        <FundingTile kind="wallet" label={formatWalletLabel(wallet)} amountCents={balanceCents(wallet)} />
      ) : null}
    </div>
  );
}
