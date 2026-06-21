import type { AnyRow } from "@/lib/types";

export type VaultFunding = {
  card: AnyRow | undefined;
  wallet: AnyRow | undefined;
};

export function fundingForVault(paymentMethods: AnyRow[], vaultId: string): VaultFunding {
  const methods = paymentMethods.filter((method) => String(method.vault_id) === vaultId);
  return {
    card: methods.find((method) => method.type === "card"),
    wallet: methods.find((method) => method.type === "stablecoin")
  };
}

export function formatCardLabel(method: AnyRow): string {
  const display = String(method.display ?? "").trim();
  const alias = String(method.alias ?? "Card").trim();
  const endingMatch = display.match(/ending\s*(\d{4})/i);
  if (endingMatch) {
    const name = display.replace(/\s*ending\s*\d{4}/i, "").trim() || alias;
    return `${endingMatch[1]} ${name}`;
  }
  const tailMatch = display.match(/(\d{4})\s*$/);
  if (tailMatch) return `${tailMatch[1]} ${alias}`;
  return alias || display || "Card";
}

export function formatWalletLabel(method: AnyRow): string {
  return String(method.alias ?? method.display ?? "Wallet");
}

export function balanceCents(method: AnyRow | undefined): number {
  return Number(method?.balance_cents ?? 0);
}

export type FundingSlot = "card" | "wallet";

export function fundingSlots(funding: VaultFunding): FundingSlot[] {
  const slots: FundingSlot[] = [];
  if (funding.card) slots.push("card");
  if (funding.wallet) slots.push("wallet");
  return slots;
}
