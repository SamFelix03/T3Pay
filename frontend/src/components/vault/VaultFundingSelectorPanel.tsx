"use client";

import type { AnyRow } from "@/lib/types";
import { formatCardLabel, formatWalletLabel } from "@/lib/vault-funding";
import { money } from "@/lib/format";
import { SelectMenu, type SelectOption } from "@/components/ui/SelectMenu";
import { VaultMiniCardPanel, VaultMiniWalletPanel } from "@/components/vault/VaultMiniAssets";
import { CreditCard, Wallet } from "lucide-react";

type Props = {
  kind: "card" | "wallet";
  items: AnyRow[];
  selectedId: string | null;
  displayName: string;
  onSelect: (id: string | null) => void;
};

function buildOptions(kind: "card" | "wallet", items: AnyRow[]): SelectOption[] {
  const skipLabel = kind === "card" ? "Skip card" : "Skip wallet";
  const emptyLabel = kind === "card" ? "No cards available" : "No wallets available";
  if (!items.length) {
    return [{ value: "", label: emptyLabel, disabled: true }];
  }
  return [
    { value: "", label: skipLabel },
    ...items.map((item) => ({
      value: String(item.id),
      label:
        kind === "card"
          ? `${formatCardLabel(item)} · ${money(Number(item.balance_cents ?? 0))}`
          : `${formatWalletLabel(item)} · ${money(Number(item.balance_cents ?? 0))}`
    }))
  ];
}

export function VaultFundingSelectorPanel({ kind, items, selectedId, displayName, onSelect }: Props) {
  const Icon = kind === "card" ? CreditCard : Wallet;
  const selected = items.find((item) => String(item.id) === selectedId) ?? null;
  const options = buildOptions(kind, items);
  const canSelect = items.length > 0;

  return (
    <section className="vault-create-funding-panel">
      <header className="vault-create-funding-head">
        <Icon className="vault-create-funding-head-icon" strokeWidth={1.75} aria-hidden />
        <span>{kind === "card" ? "Card" : "Wallet"}</span>
      </header>

      <SelectMenu
        value={selectedId ?? ""}
        options={options}
        placeholder={kind === "card" ? "Select a card" : "Select a wallet"}
        onChange={(value) => onSelect(value || null)}
      />

      {selected ? (
        kind === "card" ? (
          <VaultMiniCardPanel paymentMethod={selected} displayName={displayName} />
        ) : (
          <VaultMiniWalletPanel paymentMethod={selected} />
        )
      ) : (
        <div className="vault-create-funding-placeholder">
          <Icon className="vault-create-funding-placeholder-icon" strokeWidth={1.5} aria-hidden />
          <p>{canSelect ? `No ${kind} selected — this vault will skip it.` : `Add a ${kind} from the header first.`}</p>
        </div>
      )}
    </section>
  );
}
