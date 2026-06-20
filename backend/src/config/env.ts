import "dotenv/config";
import { APP } from "./constants";

export type Env = {
  nodeEnv: string;
  host: string;
  port: number;
  t3nApiKey?: string;
  did?: string;
  t3nEnvironment: string;
  t3nNodeUrl?: string;
  vaultpayContractId?: string;
  vaultpayContractTail: string;
  vaultpayContractVersion: string;
  groqApiKey?: string;
  groqModel: string;
  supabaseUrl: string;
  supabaseRestUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
};

export function loadEnv(): Env {
  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    host: process.env.HOST ?? APP.defaultHost,
    port: Number.parseInt(process.env.PORT ?? String(APP.defaultPort), 10),
    t3nApiKey: process.env.T3N_API_KEY,
    did: process.env.DID,
    t3nEnvironment: process.env.T3N_ENVIRONMENT ?? "testnet",
    t3nNodeUrl: process.env.T3N_NODE_URL,
    vaultpayContractId: process.env.VAULTPAY_CONTRACT_ID,
    vaultpayContractTail: process.env.VAULTPAY_CONTRACT_TAIL ?? "vaultpay-contracts",
    vaultpayContractVersion: process.env.VAULTPAY_CONTRACT_VERSION ?? "0.2.1",
    groqApiKey: process.env.GROQ_API_KEY,
    groqModel: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
    supabaseUrl: process.env.SUPABASE_URL ?? "",
    supabaseRestUrl: process.env.SUPABASE_REST_URL ?? "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  };
}
