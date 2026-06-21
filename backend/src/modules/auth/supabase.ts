import http from "node:http";
import { createClient, type User } from "@supabase/supabase-js";
import type { Env } from "../../config/env";
import { AppError } from "../../domain/errors";

export function createSupabaseAdmin(env: Env) {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new AppError(500, "supabase_auth_not_configured", "Supabase auth is not configured on the server");
  }
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function requireAuthUser(req: http.IncomingMessage, env: Env): Promise<User> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new AppError(401, "unauthorized", "Missing or invalid Authorization header");
  }
  const token = header.slice("Bearer ".length).trim();
  const client = createSupabaseAdmin(env);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    throw new AppError(401, "unauthorized", error?.message ?? "Invalid or expired session");
  }
  return data.user;
}
