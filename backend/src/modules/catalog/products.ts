import type { SupabaseRepository } from "../../db/supabase";

export type CatalogProduct = {
  id: string;
  merchantId: string;
  merchantName: string;
  name: string;
  category: string;
  priceCents: number;
  currency: string;
};

export async function loadProductCatalog(
  repo: SupabaseRepository,
  options: { category?: string; limit?: number } = {}
): Promise<CatalogProduct[]> {
  const [rawProducts, merchants] = await Promise.all([
    repo.list<any>("products", {
      ...(options.category ? { eq: { category: options.category } } : {}),
      order: { column: "price_cents", ascending: true },
      limit: options.limit ?? 50
    }),
    repo.list<any>("merchants")
  ]);
  const merchantById = new Map(merchants.map((merchant: any) => [merchant.id, merchant]));

  return rawProducts.map((product: any) => ({
    id: product.id,
    merchantId: product.merchant_id,
    merchantName: merchantById.get(product.merchant_id)?.name ?? product.merchant_id,
    name: product.name,
    category: product.category,
    priceCents: product.price_cents,
    currency: product.currency
  }));
}
