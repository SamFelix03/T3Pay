"use client";

import { useState } from "react";
import type { AnyRow } from "@/lib/types";
import { getVaultLabel } from "@/lib/asset-previews";
import { fundingForVault } from "@/lib/vault-funding";
import { VaultDetailModal } from "@/components/vault/VaultDetailModal";
import { VaultGridCard } from "@/components/vault/VaultGridCard";
import { Plus } from "lucide-react";

type Props = {
  vaults: AnyRow[];
  paymentMethods: AnyRow[];
  agents: AnyRow[];
  displayName: string;
  onCreateVault: () => void;
};

export function VaultView({ vaults, paymentMethods, agents, displayName, onCreateVault }: Props) {
  const [selectedVaultId, setSelectedVaultId] = useState<string | null>(null);

  const agentCountByVault = new Map<string, number>();
  for (const agent of agents) {
    const vaultId = String(agent.vault_id ?? "");
    if (!vaultId) continue;
    agentCountByVault.set(vaultId, (agentCountByVault.get(vaultId) ?? 0) + 1);
  }

  const selectedVault = vaults.find((vault) => String(vault.id) === selectedVaultId) ?? null;
  const selectedFunding = selectedVault
    ? fundingForVault(paymentMethods, String(selectedVault.id))
    : { card: undefined, wallet: undefined };

  return (
    <>
      <div className="vault-grid">
        {vaults.map((vault) => {
          const vaultId = String(vault.id);
          const funding = fundingForVault(paymentMethods, vaultId);

          return (
            <VaultGridCard
              key={vaultId}
              vaultId={vaultId}
              label={getVaultLabel(vaultId)}
              card={funding.card}
              wallet={funding.wallet}
              onClick={() => setSelectedVaultId(vaultId)}
            />
          );
        })}

        <button type="button" className="vault-grid-card vault-grid-card--create" onClick={onCreateVault}>
          <Plus className="vault-create-icon" strokeWidth={1.75} aria-hidden />
          <strong>Create vault</strong>
          <span>Seal a card, wallet, or both for agent spending.</span>
        </button>
      </div>

      <VaultDetailModal
        open={Boolean(selectedVault)}
        vaultId={selectedVault ? String(selectedVault.id) : ""}
        label={selectedVault ? getVaultLabel(String(selectedVault.id)) : ""}
        displayName={displayName}
        card={selectedFunding.card}
        wallet={selectedFunding.wallet}
        agentCount={selectedVault ? (agentCountByVault.get(String(selectedVault.id)) ?? 0) : 0}
        onClose={() => setSelectedVaultId(null)}
      />
    </>
  );
}
