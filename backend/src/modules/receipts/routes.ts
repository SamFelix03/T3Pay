import { Router } from "../../http/router";
import { listReceipts, verifyReceipt } from "./service";

export function registerReceiptRoutes(router: Router): void {
  router.get("/api/receipts", async ({ app, url }) => {
    const userId = url.searchParams.get("userId");
    const receipts = await listReceipts(app.repo, userId);
    return { receipts };
  });
  router.get("/api/receipts/:id", async ({ params, app }) => ({ receipt: await verifyReceipt(app.repo, params.id) }));
  router.post("/api/receipts/:id/verify", async ({ params, app }) => ({ receipt: await verifyReceipt(app.repo, params.id) }));
}
