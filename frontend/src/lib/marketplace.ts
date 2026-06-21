import type { Product, UseCase } from "@/lib/types";

export type MarketplaceUseCase = {
  id: UseCase;
  label: string;
  objective: string;
  description: string;
  merchants: Array<{ id: string; name: string }>;
};

export const MARKETPLACE_USE_CASES: MarketplaceUseCase[] = [
  {
    id: "electronics",
    label: "Electronics",
    objective: "Find a useful electronics purchase under policy.",
    description: "USB chargers, headphones, keyboards, and developer laptops from sealed card checkout.",
    merchants: [{ id: "electronics-store", name: "Vault Electronics" }]
  },
  {
    id: "groceries",
    label: "Groceries",
    objective: "Choose groceries that fit the weekly restock budget.",
    description: "Weekly baskets, pantry packs, and produce boxes paid from USDC wallets.",
    merchants: [{ id: "grocery-market", name: "Vault Groceries" }]
  },
  {
    id: "travel",
    label: "Travel",
    objective: "Book travel while respecting approval thresholds.",
    description: "Hotels, resort packages, train tickets, and airport transfers with mandate guardrails.",
    merchants: [{ id: "travel-booking", name: "Vault Travel" }]
  }
];

export function groupProductsByUseCase(products: Product[]): Record<UseCase, Product[]> {
  return {
    electronics: products.filter((product) => product.category === "electronics"),
    groceries: products.filter((product) => product.category === "groceries"),
    travel: products.filter((product) => product.category === "travel")
  };
}
