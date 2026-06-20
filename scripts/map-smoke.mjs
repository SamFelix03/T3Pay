import { createAuthenticatedClients } from "./lib/t3n-client.mjs";
import { loadEnv } from "./lib/env.mjs";

loadEnv();

const tail = process.env.VAULTPAY_SMOKE_MAP || "mandates";
try {
  const { did, tenant } = await createAuthenticatedClients();
  const mapName = tenant.canonicalName(tail);
  const key = `smoke_${Date.now()}`;
  const value =
    process.env.VAULTPAY_SMOKE_VALUE_KIND === "mandate"
      ? JSON.stringify({
          mandate_id: key,
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
          mandate_hash: "probe",
        })
      : process.env.VAULTPAY_SMOKE_VALUE_KIND === "long"
        ? "x".repeat(Number.parseInt(process.env.VAULTPAY_SMOKE_LONG_LEN || "600", 10))
      : JSON.stringify({ ok: true, key });

  const result = await tenant.executeControl("map-entry-set", {
    map_name: mapName,
    key,
    value,
  });

  console.log(
    JSON.stringify(
      { did, mapName, key, valueKind: process.env.VAULTPAY_SMOKE_VALUE_KIND || "small", valueBytes: Buffer.byteLength(value, "utf8"), result },
      null,
      2
    )
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
