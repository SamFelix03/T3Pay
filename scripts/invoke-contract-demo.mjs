import { createAuthenticatedClients } from "./lib/t3n-client.mjs";
import { loadEnv } from "./lib/env.mjs";
import { writeMapValue } from "./lib/t3n-kv.mjs";

loadEnv();

const CONTRACT_TAIL = process.env.VAULTPAY_CONTRACT_TAIL || "vaultpay-contracts";
const CONTRACT_VERSION = process.env.VAULTPAY_CONTRACT_VERSION || "0.2.1";

const decodeMaybeBytes = (value) => {
  if (Array.isArray(value)) {
    return JSON.parse(new TextDecoder().decode(new Uint8Array(value)));
  }
  if (value instanceof Uint8Array) {
    return JSON.parse(new TextDecoder().decode(value));
  }
  return value;
};

try {
  const { did, tenant } = await createAuthenticatedClients();
  const mandateId = `mandate_demo_${Date.now()}`;

  const mandate = {
    v: 1,
    id: mandateId,
    a: "agent_electronics_card",
    d: did,
    b: 50000,
    r: 50000,
    l: 25000,
    t: 30000,
    x: 4102444800,
    m: ["merchant_electronics"],
    c: ["electronics"],
    p: ["card", "stablecoin"],
    s: "active",
  };

  const createResult = await tenant.contracts.execute(CONTRACT_TAIL, {
    version: CONTRACT_VERSION,
    functionName: "create-mandate",
    input: { mandate },
  });
  const created = decodeMaybeBytes(createResult);

  const persistence = await writeMapValue(tenant, {
    mapTail: "mandates",
    key: mandateId,
    value: JSON.stringify(created),
  });

  const readResult = await tenant.contracts.execute(CONTRACT_TAIL, {
    version: CONTRACT_VERSION,
    functionName: "read-mandate",
    input: { mandate_id: mandateId },
  });

  const decisionResult = await tenant.contracts.execute(CONTRACT_TAIL, {
    version: CONTRACT_VERSION,
    functionName: "validate-and-pay",
    input: {
      mandate_id: mandateId,
      app_agent_id: "agent_electronics_card",
      agent_did: did,
      merchant_id: "merchant_electronics",
      category: "electronics",
      amount_cents: 9999,
      payment_method: "card",
    },
  });

  console.log(
    JSON.stringify(
      {
        did,
        contractTail: CONTRACT_TAIL,
        contractVersion: CONTRACT_VERSION,
        persistence,
        created,
        readBack: decodeMaybeBytes(readResult),
        decision: decodeMaybeBytes(decisionResult),
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
