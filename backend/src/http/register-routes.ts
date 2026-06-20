import { Router } from "./router";
import { registerActivityRoutes } from "../modules/activity/routes";
import { registerAgentRoutes } from "../modules/agents/routes";
import { registerAgentRunRoutes } from "../modules/agent-runs/routes";
import { registerApprovalRoutes } from "../modules/approvals/routes";
import { registerDashboardRoutes } from "../modules/dashboard/routes";
import { registerDemoRoutes } from "../modules/demo/routes";
import { registerMandateRoutes } from "../modules/mandates/routes";
import { registerMerchantRoutes } from "../modules/merchant/routes";
import { registerReceiptRoutes } from "../modules/receipts/routes";
import { registerTaskRoutes } from "../modules/tasks/routes";
import { registerT3nRoutes } from "../modules/t3n/routes";
import { registerUserRoutes } from "../modules/users/routes";
import { registerVaultRoutes } from "../modules/vaults/routes";

export function registerRoutes(router: Router): void {
  router.get("/health", () => ({ ok: true }));
  registerUserRoutes(router);
  registerVaultRoutes(router);
  registerAgentRoutes(router);
  registerAgentRunRoutes(router);
  registerMandateRoutes(router);
  registerTaskRoutes(router);
  registerApprovalRoutes(router);
  registerActivityRoutes(router);
  registerReceiptRoutes(router);
  registerMerchantRoutes(router);
  registerDashboardRoutes(router);
  registerT3nRoutes(router);
  registerDemoRoutes(router);
}
