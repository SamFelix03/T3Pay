import { createAuthenticatedClients } from "./lib/t3n-client.mjs";
import { loadEnv } from "./lib/env.mjs";

loadEnv();

const merchantApiKey = process.env.MOCK_MERCHANT_API_KEY;
if (!merchantApiKey) {
  throw new Error("Set MOCK_MERCHANT_API_KEY before seeding merchant credentials");
}

const { did, tenant } = await createAuthenticatedClients();
const result = await tenant.executeControl("map-entry-set", {
  map_name: tenant.canonicalName("secrets"),
  key: "mock_merchant_api_key",
  value: merchantApiKey,
});

console.log(JSON.stringify({ did, seeded: "mock_merchant_api_key", result }, null, 2));
