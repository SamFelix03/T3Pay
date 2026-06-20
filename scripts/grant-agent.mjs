import {
  createEthAuthInput,
  eth_get_address,
  getNodeUrl,
  getScriptVersion,
  loadWasmComponent,
  metamask_sign,
  T3nClient,
} from "@terminal3/t3n-sdk";
import { createHmac } from "node:crypto";
import { createAuthenticatedClients } from "./lib/t3n-client.mjs";
import { loadEnv } from "./lib/env.mjs";

loadEnv();

const CONTRACT_TAIL = process.env.VAULTPAY_CONTRACT_TAIL || "vaultpay-contracts";
const FUNCTIONS = ["create-mandate", "read-mandate", "revoke-mandate", "validate-and-pay"];
const ALLOWED_HOSTS = (process.env.VAULTPAY_ALLOWED_HOSTS || "localhost,127.0.0.1")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

const { did, t3n } = await createAuthenticatedClients();
const appAgentId = process.env.VAULTPAY_AGENT_APP_ID || "cli-agent";
const agentPrivateKey = deriveAgentPrivateKey(process.env.T3N_API_KEY, appAgentId);
const agentAddress = eth_get_address(agentPrivateKey);
const agentClient = new T3nClient({
  baseUrl: getNodeUrl(),
  wasmComponent: await loadWasmComponent(),
  handlers: {
    EthSign: metamask_sign(agentAddress, undefined, agentPrivateKey),
  },
});
await agentClient.handshake();
const agentDid = (await agentClient.authenticate(createEthAuthInput(agentAddress))).value;
const tenantId = did.slice("did:t3n:".length);
const scriptName = `z:${tenantId}:${CONTRACT_TAIL}`;
const scriptVersion = await getScriptVersion(getNodeUrl(), scriptName);
const userContractVersion = await getScriptVersion(getNodeUrl(), "tee:user/contracts");

const result = await t3n.executeAndDecode({
  script_name: "tee:user/contracts",
  script_version: userContractVersion,
  function_name: "agent-auth-update",
  input: {
    agents: [
      {
        agentDid,
        scripts: [
          {
            scriptName,
            versionReq: scriptVersion,
            functions: FUNCTIONS,
            allowedHosts: ALLOWED_HOSTS,
          },
        ],
      },
    ],
  },
});

console.log(
  JSON.stringify(
      {
      did,
      appAgentId,
      agentDid,
      scriptName,
      scriptVersion,
      functions: FUNCTIONS,
      allowedHosts: ALLOWED_HOSTS,
      result,
    },
    null,
    2
  )
);

function deriveAgentPrivateKey(rootPrivateKey, appAgentId) {
  if (!rootPrivateKey) throw new Error("Missing T3N_API_KEY");
  const keyHex = rootPrivateKey.startsWith("0x") ? rootPrivateKey.slice(2) : rootPrivateKey;
  const secret = createHmac("sha256", Buffer.from(keyHex, "hex"))
    .update(`vaultpay:t3n-agent:${appAgentId}`)
    .digest("hex");
  return `0x${secret}`;
}
