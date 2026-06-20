import { createECDH, createHmac, randomBytes } from "node:crypto";
import { ADK_AGENT_AUTH, T3N_MAP_TAILS } from "../../config/constants";
import { Env } from "../../config/env";
import { badRequest } from "../../domain/errors";
import { sha256Json } from "../../domain/ids";
import { assertContractRecordSize } from "../shared";

const T3N_RATE_LIMIT_RETRY_MS = 65_000;

type PaymentMethod = "card" | "stablecoin";
type RecordStatus = "active" | "revoked" | "approved" | "rejected" | "pending";

export type CompactMandateRecord = {
  v: 1;
  id: string;
  a: string;
  d: string;
  b: number;
  r: number;
  l: number;
  t: number;
  x: number;
  m: string[];
  c: string[];
  p: PaymentMethod[];
  s: "active" | "revoked";
  h?: string;
};

export type CompactApprovalRecord = {
  v: 1;
  id: string;
  mid: string;
  aid: string;
  amt: number;
  s: RecordStatus;
  exp: number;
  h?: string;
};

export type CompactReceiptRecord = {
  v: 1;
  id: string;
  pid: string;
  mid: string;
  aid: string;
  mer: string;
  amt: number;
  ord: string;
  mh: string;
  h?: string;
};

export type T3nPolicyDecision = {
  decision: "approved" | "rejected" | "pending_approval" | "revoked" | "expired";
  reason: string | null;
  mandate_id: string;
  budget_remaining_cents: number;
  mandate_hash: string;
};

type Clients = {
  did: string;
  baseUrl: string;
  t3n: any;
  tenant: any;
};

export class VaultpayT3nGateway {
  private clients?: Promise<Clients>;

  constructor(private readonly env: Env) {}

  configured(): boolean {
    return Boolean(this.env.t3nApiKey && this.env.did);
  }

  async createMandate(record: CompactMandateRecord): Promise<CompactMandateRecord> {
    assertContractRecordSize("mandate", record);
    const created = await this.execute<CompactMandateRecord>("create-mandate", { mandate: record });
    await this.writeMapValue(T3N_MAP_TAILS.mandates, created.id, JSON.stringify(created));
    return created;
  }

  async revokeMandate(mandateId: string): Promise<CompactMandateRecord> {
    const revoked = await this.execute<CompactMandateRecord>("revoke-mandate", { mandate_id: mandateId });
    await this.writeMapValue(T3N_MAP_TAILS.mandates, revoked.id, JSON.stringify(revoked));
    return revoked;
  }

  async readMandate(mandateId: string): Promise<CompactMandateRecord> {
    return this.execute<CompactMandateRecord>("read-mandate", { mandate_id: mandateId });
  }

  async validateAndPay(input: {
    mandateId: string;
    approvalId?: string;
    appAgentId: string;
    agentDid: string;
    delegationId?: string;
    delegationVcId?: string;
    merchantId: string;
    category: string;
    amountCents: number;
    paymentMethod: PaymentMethod;
  }): Promise<T3nPolicyDecision> {
    return this.execute<T3nPolicyDecision>("validate-and-pay", {
      mandate_id: input.mandateId,
      ...(input.approvalId ? { approval_id: input.approvalId } : {}),
      app_agent_id: input.appAgentId,
      agent_did: input.agentDid,
      ...(input.delegationId ? { delegation_id: input.delegationId } : {}),
      ...(input.delegationVcId ? { delegation_vc_id: input.delegationVcId } : {}),
      merchant_id: input.merchantId,
      category: input.category,
      amount_cents: input.amountCents,
      payment_method: input.paymentMethod
    });
  }

  async createAgentIdentity(appAgentId: string): Promise<{
    did: string;
    source: "derived_adk_eth";
    publicKeyB64u: string;
  }> {
    const { createEthAuthInput, eth_get_address, metamask_sign } = await import("@terminal3/t3n-sdk");
    const { secret, privateKey } = this.deriveAgentSecret(appAgentId);
    const address = eth_get_address(privateKey);
    const agentClient = await this.createT3nClient(address, privateKey);
    await agentClient.handshake();
    const did = (await agentClient.authenticate(createEthAuthInput(address))).value;
    return {
      did,
      source: "derived_adk_eth",
      publicKeyB64u: await encodeB64u(compressedPublicKey(secret))
    };
  }

  async createAgentGrant(input: {
    appAgentId: string;
    agentDid: string;
    role: string;
    mandateId: string;
    mandateHash: string;
    allowedMerchants: string[];
    allowedCategories: string[];
    paymentMethods: string[];
    functions?: string[];
    allowedHosts?: string[];
    notAfterSecs?: number;
  }): Promise<{
    status: "active";
    userDid: string;
    agentDid: string;
    agentPubkeyB64u: string;
    vcId: string;
    credentialJcsB64u: string;
    userSigB64u: string;
    agentNonceB64u: string;
    requestHashB64u: string;
    agentInvocationSigB64u: string;
    contractName: string;
    contractVersion: string;
    functions: string[];
    allowedHosts: string[];
    metadata: Record<string, string>;
    t3nGrantResult: unknown;
  }> {
    const { did, tenant, t3n, baseUrl } = await this.getClients();
    const {
      buildDelegationCredential,
      buildInvocationPreimage,
      b64uEncodeBytes,
      canonicaliseCredential,
      getScriptVersion,
      signAgentInvocation,
      signCredential
    } = await import("@terminal3/t3n-sdk");
    const { secret: agentSecret } = this.deriveAgentSecret(input.appAgentId);
    const agentPubkey = compressedPublicKey(agentSecret);
    const functions = [...new Set(input.functions ?? [...ADK_AGENT_AUTH.grantFunctions])].sort();
    const allowedHosts = [...new Set(input.allowedHosts ?? [...ADK_AGENT_AUTH.allowedHosts])].sort();
    const contractName = tenant.canonicalName(this.env.vaultpayContractTail);
    const credentialContract = this.env.vaultpayContractTail;
    const contractVersion = await getScriptVersion(baseUrl, contractName);
    const nowSecs = Math.floor(Date.now() / 1000);
    const vcIdBytes = randomBytes(16);
    const metadata = {
      app_agent_id: input.appAgentId,
      mandate_id: input.mandateId,
      mandate_hash: input.mandateHash,
      role: input.role,
      payment_methods: input.paymentMethods.join(",")
    };
    const credential = buildDelegationCredential({
      user_did: did,
      agent_pubkey: agentPubkey,
      org_did: did,
      contract: credentialContract,
      functions,
      scopes: [
        `mandates/${input.mandateId}`,
        ...input.allowedMerchants.map((merchant) => `merchants/${merchant}`),
        ...input.allowedCategories.map((category) => `categories/${category}`)
      ].sort(),
      metadata,
      not_before_secs: nowSecs,
      not_after_secs: input.notAfterSecs ?? nowSecs + ADK_AGENT_AUTH.grantValiditySeconds,
      vc_id: vcIdBytes
    });
    const credentialJcs = canonicaliseCredential(credential);
    const userSecret = keyBytes(this.env.t3nApiKey ?? "");
    const userSig = signCredential(credentialJcs, userSecret).sig;
    const grantRequest = {
      mandate_id: input.mandateId,
      agent_did: input.agentDid,
      contract: credentialContract,
      contract_version: contractVersion,
      functions,
      allowed_hosts: allowedHosts,
      metadata
    };
    const reqHash = hashHexToBytes(sha256Json(grantRequest));
    const nonce = randomBytes(16);
    const preimage = buildInvocationPreimage(vcIdBytes, nonce, reqHash);
    const agentInvocationSig = signAgentInvocation(preimage, agentSecret);
    const userContractVersion = await getScriptVersion(baseUrl, "tee:user/contracts");
    const t3nGrantResult = await withT3nRetry(() =>
      t3n.executeAndDecode({
        script_name: "tee:user/contracts",
        script_version: userContractVersion,
        function_name: "agent-auth-update",
        input: {
          agents: [
            {
              agentDid: input.agentDid,
              scripts: [
                {
                  scriptName: contractName,
                  versionReq: contractVersion,
                  functions,
                  allowedHosts
                }
              ]
            }
          ]
        }
      })
    );
    return {
      status: "active",
      userDid: did,
      agentDid: input.agentDid,
      agentPubkeyB64u: b64uEncodeBytes(agentPubkey),
      vcId: b64uEncodeBytes(vcIdBytes),
      credentialJcsB64u: b64uEncodeBytes(credentialJcs),
      userSigB64u: b64uEncodeBytes(userSig),
      agentNonceB64u: b64uEncodeBytes(nonce),
      requestHashB64u: b64uEncodeBytes(reqHash),
      agentInvocationSigB64u: b64uEncodeBytes(agentInvocationSig),
      contractName,
      contractVersion,
      functions,
      allowedHosts,
      metadata,
      t3nGrantResult
    };
  }

  async revokeAgentGrant(input: { credentialJcsB64u?: string; revokedFunctions?: string[] }): Promise<unknown> {
    if (!input.credentialJcsB64u) throw badRequest("delegation credential is missing");
    const credentialJcsB64u = input.credentialJcsB64u;
    const { baseUrl, t3n } = await this.getClients();
    const { revokeDelegation } = await import("@terminal3/t3n-sdk");
    return withT3nRetry(() =>
      revokeDelegation({
        credentialJcsB64u,
        revokedFunctions: input.revokedFunctions,
        client: t3n,
        baseUrl
      })
    );
  }

  async getAgentProof(agentDid?: string): Promise<{ audit: unknown; logs: unknown }> {
    const { t3n, tenant } = await this.getClients();
    const [audit, logs] = await Promise.all([
      withT3nRetry(() => t3n.getAuditEvents({ limit: 25 })).then((page: any) => ({
        requestedActorDid: agentDid ?? null,
        page
      })).catch((error) => ({
        unavailable: true,
        requestedActorDid: agentDid ?? null,
        reason: error instanceof Error ? error.message : String(error)
      })),
      withT3nRetry(() => tenant.contracts.logs(this.env.vaultpayContractTail, { limit: 50 })).catch((error) => ({
        unavailable: true,
        reason: error instanceof Error ? error.message : String(error)
      }))
    ]);
    return { audit, logs };
  }

  async createApproval(record: CompactApprovalRecord): Promise<CompactApprovalRecord> {
    assertContractRecordSize("approval", record);
    const created = await this.execute<CompactApprovalRecord>("create-approval-request", { approval: record });
    await this.writeMapValue(T3N_MAP_TAILS.approvals, created.id, JSON.stringify(created));
    return created;
  }

  async approveAction(approvalId: string): Promise<CompactApprovalRecord> {
    const approved = await this.execute<CompactApprovalRecord>("approve-action", { approval_id: approvalId });
    await this.writeMapValue(T3N_MAP_TAILS.approvals, approved.id, JSON.stringify(approved));
    return approved;
  }

  async rejectAction(approvalId: string): Promise<CompactApprovalRecord> {
    const rejected = await this.execute<CompactApprovalRecord>("reject-action", { approval_id: approvalId });
    await this.writeMapValue(T3N_MAP_TAILS.approvals, rejected.id, JSON.stringify(rejected));
    return rejected;
  }

  async issueReceipt(record: CompactReceiptRecord): Promise<CompactReceiptRecord> {
    assertContractRecordSize("receipt", record);
    const receipt = await this.execute<CompactReceiptRecord>("issue-receipt", { receipt: record });
    await this.writeMapValue(T3N_MAP_TAILS.receipts, receipt.id, JSON.stringify(receipt));
    return receipt;
  }

  async verifyReceipt(record: CompactReceiptRecord): Promise<{ valid: boolean; receipt_id: string }> {
    return this.execute("verify-receipt", { receipt: record });
  }

  async writeMapValue(mapTail: string, key: string, value: string): Promise<void> {
    const { tenant } = await this.getClients();
    await withT3nRetry(() =>
      tenant.executeControl("map-entry-set", {
        map_name: tenant.canonicalName(mapTail),
        key,
        value
      })
    );
  }

  private async execute<T>(functionName: string, input: Record<string, unknown>): Promise<T> {
    const { tenant } = await this.getClients();
    const result = await withT3nRetry(() =>
      tenant.contracts.execute(this.env.vaultpayContractTail, {
        version: this.env.vaultpayContractVersion,
        functionName,
        input
      })
    );
    return decodeContractResult<T>(result);
  }

  private getClients(): Promise<Clients> {
    if (!this.clients) this.clients = this.createClients();
    return this.clients;
  }

  private async createClients(): Promise<Clients> {
    if (!this.env.t3nApiKey) throw badRequest("T3N_API_KEY is not configured");
    if (!this.env.did) throw badRequest("DID is not configured");
    const {
      T3nClient,
      TenantClient,
      createEthAuthInput,
      eth_get_address,
      getNodeUrl,
      loadWasmComponent,
      metamask_sign,
      setEnvironment,
      setNodeUrl
    } = await import("@terminal3/t3n-sdk");
    configureT3nSdk({ setEnvironment, setNodeUrl }, this.env);
    const baseUrl = getNodeUrl();
    const privateKey = this.env.t3nApiKey;
    const address = eth_get_address(privateKey);
    const t3n = await this.createT3nClient(address, privateKey);
    await t3n.handshake();
    const did = (await t3n.authenticate(createEthAuthInput(address))).value;
    if (did !== this.env.did) throw badRequest("authenticated T3N DID does not match configured DID");
    const tenant = new TenantClient({
      environment: this.env.t3nEnvironment as "testnet" | "production",
      baseUrl,
      endpoint: baseUrl,
      t3n,
      tenantDid: did
    });
    return { did, baseUrl, t3n, tenant };
  }

  private async createT3nClient(address: string, privateKey: string): Promise<any> {
    const { T3nClient, getNodeUrl, loadWasmComponent, metamask_sign, setEnvironment, setNodeUrl } = await import("@terminal3/t3n-sdk");
    configureT3nSdk({ setEnvironment, setNodeUrl }, this.env);
    const baseUrl = getNodeUrl();
    return new T3nClient({
      baseUrl,
      wasmComponent: await loadWasmComponent(),
      handlers: {
        EthSign: metamask_sign(address, undefined, privateKey)
      }
    });
  }

  private deriveAgentSecret(appAgentId: string): { secret: Uint8Array; privateKey: string } {
    if (!this.env.t3nApiKey) throw badRequest("T3N_API_KEY is not configured");
    const secret = createHmac("sha256", keyBytes(this.env.t3nApiKey))
      .update(`vaultpay:t3n-agent:${appAgentId}`)
      .digest();
    if (secret.every((byte) => byte === 0)) throw badRequest("invalid derived agent key");
    return { secret, privateKey: `0x${secret.toString("hex")}` };
  }
}

function configureT3nSdk(
  sdk: { setEnvironment: (env: "testnet" | "production") => void; setNodeUrl: (url: string) => void },
  env: Env
): void {
  sdk.setEnvironment(env.t3nEnvironment as "testnet" | "production");
  if (env.t3nNodeUrl) sdk.setNodeUrl(env.t3nNodeUrl);
}

function decodeContractResult<T>(result: unknown): T {
  if (Array.isArray(result)) {
    return JSON.parse(new TextDecoder().decode(new Uint8Array(result))) as T;
  }
  if (result instanceof Uint8Array) {
    return JSON.parse(new TextDecoder().decode(result)) as T;
  }
  return result as T;
}

async function withT3nRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isT3nRateLimit(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, T3N_RATE_LIMIT_RETRY_MS));
    return operation();
  }
}

function isT3nRateLimit(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("too_many_requests") || message.includes("fuel_per_minute") || message.includes("Rate limit exceeded");
}

function keyBytes(privateKey: string): Uint8Array {
  const hex = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
  return new Uint8Array(Buffer.from(hex, "hex"));
}

function hashHexToBytes(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex, "hex"));
}

function compressedPublicKey(secret: Uint8Array): Uint8Array {
  const ecdh = createECDH("secp256k1");
  ecdh.setPrivateKey(Buffer.from(secret));
  return new Uint8Array(ecdh.getPublicKey(undefined, "compressed"));
}

async function encodeB64u(bytes: Uint8Array): Promise<string> {
  const { b64uEncodeBytes } = await import("@terminal3/t3n-sdk");
  return b64uEncodeBytes(bytes);
}
