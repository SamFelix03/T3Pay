import { Router } from "../../http/router";
import { verifyReceipt } from "./service";

export function registerReceiptRoutes(router: Router): void {
  router.get("/api/receipts/:id", async ({ params, app }) => ({ receipt: await verifyReceipt(app.repo, params.id) }));
  router.post("/api/receipts/:id/verify", async ({ params, app }) => ({ receipt: await verifyReceipt(app.repo, params.id) }));
}
