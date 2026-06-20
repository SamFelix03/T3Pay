import { createAuthenticatedClients } from "./lib/t3n-client.mjs";
import { loadEnv } from "./lib/env.mjs";

loadEnv();

const CONTRACT_TAIL = process.env.VAULTPAY_CONTRACT_TAIL || "vaultpay-contracts";
const CONTRACT_VERSION = process.env.VAULTPAY_CONTRACT_VERSION || "0.1.2";

const { did, tenant } = await createAuthenticatedClients();
const mandate = {
  mandate_id: `probe_${Date.now()}`,
  app_agent_id: "agent_electronics_card",
  t3n_did: did,
  budget: { amount: 50000, currency: "USD" },
  budget_remaining: { amount: 50000, currency: "USD" },
  per_purchase_limit: { amount: 25000, currency: "USD" },
  approval_threshold: { amount: 30000, currency: "USD" },
  allowed_merchants: ["merchant_electronics"],
  allowed_categories: ["electronics"],
  payment_methods: ["card", "stablecoin"],
  expires_at_secs: 4102444800,
  status: "active",
  mandate_hash: null,
};

const result = await tenant.contracts.execute(CONTRACT_TAIL, {
  version: CONTRACT_VERSION,
  functionName: "create-mandate",
  input: { mandate },
});

console.log(
  JSON.stringify(
    {
      did,
      resultType: typeof result,
      isArray: Array.isArray(result),
      result,
      stringifiedLength: JSON.stringify(result).length,
    },
    null,
    2
  )
);
