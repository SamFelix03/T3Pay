import { SupabaseRepository } from "../../db/supabase";
import { badRequest, conflict } from "../../domain/errors";
import { id } from "../../domain/ids";
import { MERCHANTS } from "../../config/constants";
import { asJson, nowIso } from "../shared";

const PRODUCTS = [
  { id: "prd_charger", merchantId: "electronics-store", name: "USB-C Fast Charger", category: "electronics", priceCents: 2999, currency: "USD", inventory: 25 },
  { id: "prd_headphones", merchantId: "electronics-store", name: "Noise Cancelling Headphones", category: "electronics", priceCents: 8999, currency: "USD", inventory: 11 },
  { id: "prd_keyboard", merchantId: "electronics-store", name: "Low Profile Keyboard", category: "electronics", priceCents: 17500, currency: "USD", inventory: 8 },
  { id: "prd_laptop", merchantId: "electronics-store", name: "Developer Laptop", category: "electronics", priceCents: 26000, currency: "USD", inventory: 4 },
  { id: "prd_groceries", merchantId: "grocery-market", name: "Weekly Grocery Basket", category: "groceries", priceCents: 3899, currency: "USDC", inventory: 50 },
  { id: "prd_pantry", merchantId: "grocery-market", name: "Pantry Restock Pack", category: "groceries", priceCents: 2499, currency: "USDC", inventory: 40 },
  { id: "prd_organic", merchantId: "grocery-market", name: "Organic Produce Box", category: "groceries", priceCents: 3299, currency: "USDC", inventory: 35 },
  { id: "prd_hotel", merchantId: "travel-booking", name: "One Night Hotel Booking", category: "travel", priceCents: 17500, currency: "USD", inventory: 12 },
  { id: "prd_resort", merchantId: "travel-booking", name: "Premium Resort Package", category: "travel", priceCents: 62000, currency: "USD", inventory: 5 },
  { id: "prd_train", merchantId: "travel-booking", name: "Regional Train Ticket", category: "travel", priceCents: 6200, currency: "USD", inventory: 18 },
  { id: "prd_airport", merchantId: "travel-booking", name: "Airport Transfer", category: "travel", priceCents: 4800, currency: "USD", inventory: 20 }
];

export async function seedMerchantCatalog(repo: SupabaseRepository): Promise<void> {
  for (const merchant of MERCHANTS) {
    await repo.upsert("merchants", { ...merchant, status: "active" });
  }
  for (const product of PRODUCTS) {
    await repo.upsert("products", {
      id: product.id,
      merchant_id: product.merchantId,
      name: product.name,
      category: product.category,
      price_cents: product.priceCents,
      currency: product.currency,
      inventory: product.inventory
    });
  }
}

export async function listProducts(repo: SupabaseRepository) {
  const [products, merchants] = await Promise.all([
    repo.list<any>("products", { order: { column: "price_cents", ascending: true } }),
    repo.list<any>("merchants")
  ]);
  const merchantById = new Map(merchants.map((merchant: any) => [merchant.id, merchant]));
  return products
    .map((product: any) => ({ ...product, merchant_name: merchantById.get(product.merchant_id)?.name ?? product.merchant_id }))
    .sort((a: any, b: any) => `${a.category}:${a.price_cents}`.localeCompare(`${b.category}:${b.price_cents}`));
}

export async function checkout(
  repo: SupabaseRepository,
  input: { merchantId: string; productId: string; paymentMethodId: string; expectedAmountCents: number }
) {
  return repo.mutate(async () => {
    const product = await repo.getById<any>("products", input.productId, "product");
    if (product.merchant_id !== input.merchantId) throw badRequest("product does not belong to merchant");
    const merchant = await repo.getById<any>("merchants", input.merchantId, "merchant");
    if (merchant.status !== "active") throw badRequest("merchant is not active");
    if (product.inventory <= 0) throw conflict("product is out of stock");
    if (product.price_cents !== input.expectedAmountCents) throw badRequest("amount does not match product price");

    const paymentMethod = await repo.getById<any>("payment_methods", input.paymentMethodId, "payment method");
    if (paymentMethod.status !== "active") throw badRequest("payment method is not active");
    if (paymentMethod.balance_cents < product.price_cents) throw conflict("insufficient mock payment balance");

    await repo.update("payment_methods", input.paymentMethodId, {
      balance_cents: paymentMethod.balance_cents - product.price_cents
    });
    await repo.update("products", product.id, { inventory: product.inventory - 1 });

    const orderId = id("ord");
    const createdAt = nowIso();
    const confirmation = {
      orderId,
      merchantId: input.merchantId,
      productId: input.productId,
      status: "paid",
      amountCents: product.price_cents,
      currency: product.currency
    };
    await repo.insert("merchant_orders", {
        id: orderId,
        merchant_id: input.merchantId,
        product_id: input.productId,
        payment_method_id: input.paymentMethodId,
        amount_cents: product.price_cents,
        currency: product.currency,
        status: "paid",
        sanitized_confirmation_json: asJson(confirmation),
        created_at: createdAt
    });
    return confirmation;
  });
}
