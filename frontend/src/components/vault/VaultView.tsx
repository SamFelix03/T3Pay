"use client";

import type { AnyRow } from "@/lib/types";
import { getVaultLabel } from "@/lib/asset-previews";
import { money, short } from "@/lib/format";
import { FieldRow } from "@/components/ui/primitives";

type Props = {
  session: { userId: string; userDid: string; displayName: string };
  vaults: AnyRow[];
  paymentMethods: AnyRow[];
  mandates: AnyRow[];
};

export function VaultView({ session, vaults, paymentMethods, mandates }: Props) {
  return (
    <div className="view-stack">
      <section className="surface-card">
        <span className="section-label">Account</span>
        <div className="insight-grid">
          <FieldRow label="User" value={session.displayName} />
          <FieldRow label="User DID" value={short(session.userDid)} />
          <FieldRow label="Vaults" value={String(vaults.length)} />
        </div>
      </section>

      {vaults.map((vault) => {
        const methods = paymentMethods.filter((method) => String(method.vault_id) === String(vault.id));
        const card = methods.find((method) => method.type === "card");
        const wallet = methods.find((method) => method.type === "stablecoin");
        return (
          <section key={String(vault.id)} className="surface-card">
            <span className="section-label">{getVaultLabel(String(vault.id))}</span>
            <div className="insight-grid three">
              <FieldRow label="Vault id" value={short(vault.id)} />
              <FieldRow label="Card" value={card ? money(Number(card.balance_cents ?? 0)) : "—"} />
              <FieldRow label="Wallet" value={wallet ? money(Number(wallet.balance_cents ?? 0)) : "—"} />
            </div>
            <p className="card-note">Use the header Card and Wallet buttons to view sealed credentials.</p>
          </section>
        );
      })}

      {!vaults.length ? (
        <section className="surface-card">
          <p className="empty-state">No vaults yet. Create one from the dashboard.</p>
        </section>
      ) : null}

      {mandates.length ? (
        <section className="surface-card">
          <span className="section-label">Mandates</span>
          <div className="data-table">
            {mandates.map((mandate) => (
              <div key={String(mandate.id)} className="data-row">
                <span>{short(mandate.id)}</span>
                <span>{String(mandate.status)}</span>
                <span>{money(Number(mandate.budget_remaining_cents ?? 0))}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
