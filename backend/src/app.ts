import http from "node:http";
import { loadEnv } from "./config/env";
import { SupabaseRepository } from "./db/supabase";
import { Router } from "./http/router";
import { registerRoutes } from "./http/register-routes";
import { seedMerchantCatalog } from "./modules/merchant/service";
import { VaultpayT3nGateway } from "./modules/t3n/gateway";

export async function createApp() {
  const env = loadEnv();
  const repo = new SupabaseRepository(env);
  const t3n = new VaultpayT3nGateway(env);
  await seedMerchantCatalog(repo);
  const router = new Router();
  registerRoutes(router);
  return {
    env,
    repo,
    t3n,
    server: http.createServer(router.handler({ env, repo, t3n }))
  };
}
