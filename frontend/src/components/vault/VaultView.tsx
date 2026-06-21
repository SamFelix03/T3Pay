"use client";

import type { AnyRow } from "@/lib/types";
import { getVaultLabel } from "@/lib/asset-previews";
import { money, short } from "@/lib/format";

type Props = {
  vaults: AnyRow[];
  paymentMethods: AnyRow[];
  agents: AnyRow[];
  onCreateVault: () => void;
};

import { VaultFundingBadges } from "@/components/vault/VaultFundingBadges";

export function VaultView({ vaults, paymentMethods, agents, onCreateVault }: Props) {
  const agentCountByVault = new Map<string, number>();
  for (const agent of agents) {
    const vaultId = String(agent.vault_id ?? "");
    if (!vaultId) continue;
    agentCountByVault.set(vaultId, (agentCountByVault.get(vaultId) ?? 0) + 1);
  }

  return (
    <div className="view-stack vault-page">
      <section className="vault-page-hero surface-card">
        <div>
          <span className="section-label">Vaults</span>
          <h2>Secure funding compartments</h2>
          <p>Each vault seals the cards and wallets your agents can spend from under mandate policy.</p>
        </div>
        <button type="button" className="primary-btn" onClick={onCreateVault}>
          Create vault
        </button>
      </section>

      <div className="vault-illustration-grid">
        {vaults.map((vault) => {
          const vaultId = String(vault.id);
          const methods = paymentMethods.filter((method) => String(method.vault_id) === vaultId);
          const card = methods.find((method) => method.type === "card");
          const wallet = methods.find((method) => method.type === "stablecoin");
          const totalBalance = methods.reduce((sum, method) => sum + Number(method.balance_cents ?? 0), 0);
          const boundAgents = agentCountByVault.get(vaultId) ?? 0;

          return (
            <article key={vaultId} className="vault-illustration-card">
              <div className="vault-illustration-art" aria-hidden>
                <div className="vault-illustration-lock" />
                <div className="vault-illustration-door" />
              </div>
              <div className="vault-illustration-body">
                <div className="vault-illustration-head">
                  <strong>{getVaultLabel(vaultId)}</strong>
                  <span>{short(vaultId)}</span>
                </div>
                <VaultFundingBadges card={card} wallet={wallet} />
                <div className="vault-illustration-meta">
                  <span>{money(totalBalance)} available</span>
                  <span>{boundAgents} agent{boundAgents === 1 ? "" : "s"}</span>
                </div>
              </div>
            </article>
          );
        })}

        <button type="button" className="vault-illustration-card vault-create-card" onClick={onCreateVault}>
          <div className="vault-create-plus" aria-hidden>+</div>
          <strong>Create vault</strong>
          <span>Seal a card, wallet, or both for agent spending.</span>
        </button>
      </div>

      {!vaults.length ? (
        <section className="surface-card">
          <p className="empty-state">No vaults yet. Create your first vault to attach demo funding sources.</p>
        </section>
      ) : null}
    </div>
  );
}
