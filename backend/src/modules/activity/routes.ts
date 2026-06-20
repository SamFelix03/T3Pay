import { Router } from "../../http/router";
import { listActivity } from "./service";

export function registerActivityRoutes(router: Router): void {
  router.get("/api/activity", async ({ app }) => ({ activity: await listActivity(app.repo) }));
}
