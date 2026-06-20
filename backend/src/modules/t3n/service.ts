import { CONTRACT_RECORD_LIMIT_BYTES } from "../../config/constants";
import { Env } from "../../config/env";

export type T3nHealth = {
  configured: boolean;
  environment: string;
  didConfigured: boolean;
  apiKeyConfigured: boolean;
  contractId?: string;
  contractTail: string;
  contractVersion: string;
  contractRecordLimitBytes: number;
  unsupportedRequiredFeaturesRemoved: string[];
};

export function t3nHealth(env: Env): T3nHealth {
  return {
    configured: Boolean(env.t3nApiKey && env.did),
    environment: env.t3nEnvironment,
    didConfigured: Boolean(env.did),
    apiKeyConfigured: Boolean(env.t3nApiKey),
    contractId: env.vaultpayContractId,
    contractTail: env.vaultpayContractTail,
    contractVersion: env.vaultpayContractVersion,
    contractRecordLimitBytes: CONTRACT_RECORD_LIMIT_BYTES,
    unsupportedRequiredFeaturesRemoved: ["sign-sd-jwt-vc", "outbox", "tenant-imported agent-auth", "executeBusinessContract fraud signal"]
  };
}
