import type { AnyRow, Workspace } from "@/lib/types";
import { money, short } from "@/lib/format";
import { FieldRow } from "@/components/ui/primitives";

type Props = {
  workspace: Workspace;
  card: AnyRow | null;
  wallet: AnyRow | null;
  mandates: AnyRow[];
};

export function VaultView({ workspace, card, wallet, mandates }: Props) {
  return (
    <div className="view-stack">
      <section className="surface-card">
        <span className="section-label">Funding</span>
        <div className="insight-grid three">
          <FieldRow label="Card" value={card?.display ? String(card.display) : "Demo card"} />
          <FieldRow label="Card balance" value={money(Number(card?.balance_cents ?? 0))} />
          <FieldRow label="Wallet balance" value={money(Number(wallet?.balance_cents ?? 0))} />
        </div>
        <p className="card-note">Use the header Card and Wallet buttons to view sealed credentials.</p>
      </section>

      <section className="surface-card">
        <span className="section-label">Vault</span>
        <div className="insight-grid">
          <FieldRow label="Vault id" value={short(workspace.vaultId)} />
          <FieldRow label="User DID" value={short(workspace.userDid)} />
          <FieldRow label="Mandates" value={String(mandates.length)} />
        </div>
      </section>

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
