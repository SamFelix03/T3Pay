import { Router } from "../../http/router";
import { t3nHealth } from "./service";

export function registerT3nRoutes(router: Router): void {
  router.get("/api/t3n/health", ({ app }) => ({ t3n: t3nHealth(app.env) }));
}
