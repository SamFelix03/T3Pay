"use client";

import type { AnyRow } from "@/lib/types";
import type { VaultFunding } from "@/lib/vault-funding";
import { fundingSlots } from "@/lib/vault-funding";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { VaultFundingGrid } from "@/components/vault/VaultFundingGrid";

type Props = VaultFunding & {
  vaultId: string;
  label: string;
  onClick?: () => void;
  selected?: boolean;
  compact?: boolean;
};

export function VaultGridCard({ vaultId, label, card, wallet, onClick, selected = false, compact = false }: Props) {
  const interactive = Boolean(onClick);
  const slots = fundingSlots({ card, wallet });
  const className = [
    "vault-grid-card",
    compact ? "vault-grid-card--compact" : "",
    interactive ? "vault-grid-card--interactive" : "",
    selected ? "vault-grid-card--selected" : "",
    slots.length === 0 ? "vault-grid-card--empty-funding" : ""
  ]
    .filter(Boolean)
    .join(" ");

  const body = (
    <>
      <div className="vault-grid-card-brand">
        <BrandLogo variant="card" />
      </div>
      <h3 className="vault-grid-card-title">{label}</h3>
      <VaultFundingGrid card={card} wallet={wallet} />
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        aria-label={`Select ${label}`}
        aria-pressed={selected}
      >
        {body}
      </button>
    );
  }

  return (
    <article className={className} data-vault-id={vaultId}>
      {body}
    </article>
  );
}
