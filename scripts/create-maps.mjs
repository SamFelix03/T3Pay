import { createAuthenticatedClients } from "./lib/t3n-client.mjs";
import { loadEnv } from "./lib/env.mjs";

loadEnv();

const CONTRACT_ID = Number.parseInt(process.env.VAULTPAY_CONTRACT_ID || "", 10);
if (!Number.isInteger(CONTRACT_ID)) {
  throw new Error("Set VAULTPAY_CONTRACT_ID to the numeric contract id returned by register-contracts.mjs");
}

const { did, tenant } = await createAuthenticatedClients();
const maps = ["mandates", "audit", "approvals", "receipts", "secrets"];
const results = [];

for (const tail of maps) {
  try {
    const result = await tenant.maps.create({
      tail,
      visibility: "private",
      writers: { only: [CONTRACT_ID] },
      readers: { only: [CONTRACT_ID] },
    });
    results.push({ tail, status: "created", result });
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    if (message.includes("map already exists")) {
      const result = await tenant.maps.update(tail, {
        writers: { only: [CONTRACT_ID] },
        readers: { only: [CONTRACT_ID] },
      });
      results.push({ tail, status: "updated_acl", result });
    } else {
      throw error;
    }
  }
}

console.log(JSON.stringify({ did, contractId: CONTRACT_ID, results }, null, 2));
