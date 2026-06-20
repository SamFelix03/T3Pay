import {
  T3nClient,
  TenantClient,
  createEthAuthInput,
  eth_get_address,
  getNodeUrl,
  loadWasmComponent,
  metamask_sign,
  setEnvironment,
} from "@terminal3/t3n-sdk";
import { requiredEnv } from "./env.mjs";

export async function createAuthenticatedClients() {
  const environment = process.env.T3N_ENVIRONMENT || "testnet";
  setEnvironment(environment);
  const baseUrl = getNodeUrl();

  const privateKey = requiredEnv("T3N_API_KEY");
  const address = eth_get_address(privateKey);
  const wasmComponent = await loadWasmComponent();
  const t3n = new T3nClient({
    baseUrl,
    wasmComponent,
    handlers: {
      EthSign: metamask_sign(address, undefined, privateKey),
    },
  });

  await t3n.handshake();
  const did = await t3n.authenticate(createEthAuthInput(address));
  const tenant = new TenantClient({
    environment,
    baseUrl,
    endpoint: baseUrl,
    t3n,
    tenantDid: did.value,
  });

  return {
    environment,
    address,
    did: did.value,
    baseUrl,
    t3n,
    tenant,
  };
}
