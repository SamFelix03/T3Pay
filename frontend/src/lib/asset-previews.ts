import type { MockCard, MockWallet } from "./types";

type AssetPreview = {
  type: "card";
  card: MockCard;
} | {
  type: "stablecoin";
  wallet: MockWallet;
};

const PREVIEW_KEY = "t3pay_asset_previews";
const VAULT_LABEL_KEY = "t3pay_vault_labels";

function readPreviews(): Record<string, AssetPreview> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PREVIEW_KEY);
    return raw ? (JSON.parse(raw) as Record<string, AssetPreview>) : {};
  } catch {
    return {};
  }
}

function writePreviews(previews: Record<string, AssetPreview>): void {
  window.localStorage.setItem(PREVIEW_KEY, JSON.stringify(previews));
}

export function getAssetPreview(paymentMethodId: string): AssetPreview | null {
  return readPreviews()[paymentMethodId] ?? null;
}

export function saveCardPreview(paymentMethodId: string, card: MockCard): void {
  const previews = readPreviews();
  previews[paymentMethodId] = { type: "card", card };
  writePreviews(previews);
}

export function saveWalletPreview(paymentMethodId: string, wallet: MockWallet): void {
  const previews = readPreviews();
  previews[paymentMethodId] = { type: "stablecoin", wallet };
  writePreviews(previews);
}

export function loadVaultLabels(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(VAULT_LABEL_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function saveVaultLabel(vaultId: string, label: string): void {
  const labels = loadVaultLabels();
  labels[vaultId] = label;
  window.localStorage.setItem(VAULT_LABEL_KEY, JSON.stringify(labels));
}

export function getVaultLabel(vaultId: string): string {
  return loadVaultLabels()[vaultId] ?? "Vault";
}
