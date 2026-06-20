import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createAuthenticatedClients } from "./lib/t3n-client.mjs";
import { loadEnv } from "./lib/env.mjs";

loadEnv();

const CONTRACT_TAIL = process.env.VAULTPAY_CONTRACT_TAIL || "vaultpay-contracts";
const CONTRACT_VERSION = process.env.VAULTPAY_CONTRACT_VERSION || "0.2.1";
const WASM_PATH =
  process.env.VAULTPAY_WASM_PATH ||
  "contracts/vaultpay/target/wasm32-wasip2/release/vaultpay_contracts.wasm";

try {
  const { did, tenant } = await createAuthenticatedClients();
  const wasm = await readFile(resolve(process.cwd(), WASM_PATH));
  const result = await tenant.contracts.register({
    tail: CONTRACT_TAIL,
    version: CONTRACT_VERSION,
    wasm,
  });

  console.log(
    JSON.stringify(
      {
        did,
        tail: CONTRACT_TAIL,
        version: CONTRACT_VERSION,
        wasmPath: WASM_PATH,
        result,
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
