import { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";
import { SupabaseRepository } from "../db/supabase";
import { Env } from "../config/env";
import { VaultpayT3nGateway } from "../modules/t3n/gateway";

export type AppContext = {
  env: Env;
  repo: SupabaseRepository;
  t3n: VaultpayT3nGateway;
};

export type RequestContext = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  params: Record<string, string>;
  app: AppContext;
};

export type Handler = (ctx: RequestContext) => Promise<unknown> | unknown;

export type Route = {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
};
