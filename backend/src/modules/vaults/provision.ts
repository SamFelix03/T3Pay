import type { SupabaseRepository } from "../../db/supabase";
import { id } from "../../domain/ids";
import { nowIso } from "../shared";
import { writeAudit } from "../activity/service";

export const DEMO_STARTER_BALANCE_CENTS = 100_000;

export type DemoStarterKit = {
  provisioned: boolean;
  vaultId?: string;
  card?: {
    id: string;
    display: string;
    balanceCents: number;
    currency: string;
  };
  wallet?: {
    id: string;
    display: string;
    balanceCents: number;
    currency: string;
  };
};

export async function provisionDemoStarterKit(
  repo: SupabaseRepository,
  userId: string
): Promise<DemoStarterKit> {
  const vaults = await repo.list<any>("vaults", { eq: { user_id: userId } });
  if (vaults.length > 0) {
    const paymentMethods = await repo.list<any>("payment_methods", {
      in: { vault_id: vaults.map((vault: any) => vault.id) }
    });
    if (paymentMethods.length > 0) {
      return { provisioned: false };
    }
  }

  const createdAt = nowIso();
  const vaultId = id("vlt");
  await repo.insert("vaults", { id: vaultId, user_id: userId, status: "active", created_at: createdAt });
  await writeAudit(repo, {
    userId,
    type: "vault.created",
    entityType: "vault",
    entityId: vaultId,
    payload: { vaultId, source: "demo_starter_kit" }
  });

  const card = await insertPaymentMethod(repo, {
    userId,
    vaultId,
    type: "card",
    alias: "T3Pay Visa",
    balanceCents: DEMO_STARTER_BALANCE_CENTS,
    currency: "USD"
  });

  const wallet = await insertPaymentMethod(repo, {
    userId,
    vaultId,
    type: "stablecoin",
    alias: "USDC Wallet",
    balanceCents: DEMO_STARTER_BALANCE_CENTS,
    currency: "USDC"
  });

  await writeAudit(repo, {
    userId,
    type: "demo.starter_kit_provisioned",
    entityType: "vault",
    entityId: vaultId,
    payload: { vaultId, cardId: card.id, walletId: wallet.id }
  });

  return {
    provisioned: true,
    vaultId,
    card,
    wallet
  };
}

async function insertPaymentMethod(
  repo: SupabaseRepository,
  input: {
    userId: string;
    vaultId: string;
    type: "card" | "stablecoin";
    alias: string;
    balanceCents: number;
    currency: "USD" | "USDC";
  }
) {
  const paymentMethodId = id(input.type === "card" ? "card" : "wal");
  const createdAt = nowIso();
  const display =
    input.type === "card" ? `${input.alias} ending 4242` : `${input.alias} address ...7c6a`;
  const secretRef = `z:tenant:secrets/${paymentMethodId}`;
  await repo.insert("payment_methods", {
    id: paymentMethodId,
    vault_id: input.vaultId,
    type: input.type,
    alias: input.alias,
    display,
    balance_cents: input.balanceCents,
    currency: input.currency,
    status: "active",
    t3n_secret_ref: secretRef,
    created_at: createdAt
  });
  await writeAudit(repo, {
    userId: input.userId,
    type: "vault.payment_method_created",
    entityType: "payment_method",
    entityId: paymentMethodId,
    payload: { paymentMethodId, type: input.type, display, secretRef, source: "demo_starter_kit" }
  });
  return {
    id: paymentMethodId,
    display,
    balanceCents: input.balanceCents,
    currency: input.currency
  };
}
