import { z } from "zod";
import { Router, readJson } from "../../http/router";
import { checkout, listProducts } from "./service";

const checkoutSchema = z.object({
  merchantId: z.string().min(1),
  productId: z.string().min(1),
  paymentMethodId: z.string().min(1),
  expectedAmountCents: z.number().int().positive()
});

export function registerMerchantRoutes(router: Router): void {
  router.get("/merchant/products", async ({ app }) => ({ products: await listProducts(app.repo) }));
  router.get("/merchant/categories", async ({ app }) => ({
    categories: Array.from(new Set((await app.repo.list<any>("merchants")).map((row: any) => row.category))).sort()
  }));
  router.get("/merchant/orders/:id", async ({ params, app }) => {
    const order = await app.repo.getById<any>("merchant_orders", params.id, "order");
    return { order: { ...order, sanitizedConfirmation: JSON.parse(order.sanitized_confirmation_json) } };
  });
  router.post("/merchant/checkout", async ({ req, app }) => {
    const body = await readJson(req, checkoutSchema);
    return { order: await checkout(app.repo, body) };
  });
}
