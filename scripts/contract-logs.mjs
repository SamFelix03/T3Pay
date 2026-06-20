import { createAuthenticatedClients } from "./lib/t3n-client.mjs";
import { loadEnv } from "./lib/env.mjs";

loadEnv();

const CONTRACT_TAIL = process.env.VAULTPAY_CONTRACT_TAIL || "vaultpay-contracts";
const { did, tenant } = await createAuthenticatedClients();
const logs = await tenant.contracts.logs(CONTRACT_TAIL, {
  limit: Number.parseInt(process.env.VAULTPAY_LOG_LIMIT || "50", 10),
});

console.log(JSON.stringify({ did, contractTail: CONTRACT_TAIL, logs }, null, 2));
