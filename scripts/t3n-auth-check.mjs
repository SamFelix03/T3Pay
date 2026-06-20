import { createAuthenticatedClients } from "./lib/t3n-client.mjs";
import { loadEnv, maskSecret } from "./lib/env.mjs";

loadEnv();

const { environment, address, did, tenant } = await createAuthenticatedClients();

let tenantInfo = null;
try {
  tenantInfo = await tenant.tenant.me();
} catch (error) {
  tenantInfo = { error: String(error && error.message ? error.message : error) };
}

console.log(
  JSON.stringify(
    {
      environment,
      address,
      did,
      configuredDid: process.env.DID || null,
      apiKey: maskSecret(process.env.T3N_API_KEY || ""),
      tenantInfo,
    },
    null,
    2
  )
);
