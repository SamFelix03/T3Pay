import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Env } from "../config/env";
import { AppError, notFound } from "../domain/errors";

export type Row = Record<string, any>;

export class SupabaseRepository {
  readonly client: SupabaseClient;

  constructor(env: Env) {
    if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    }
    this.client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }

  async insert<T = Row>(table: string, row: Row): Promise<T> {
    const { data, error } = await this.client.from(table).insert(row).select("*").single();
    if (error) throw this.toError(error);
    return data as T;
  }

  async upsert<T = Row>(table: string, row: Row): Promise<T> {
    const { data, error } = await this.client.from(table).upsert(row).select("*").single();
    if (error) throw this.toError(error);
    return data as T;
  }

  async getById<T = Row>(table: string, id: string, resource = table): Promise<T> {
    const { data, error } = await this.client.from(table).select("*").eq("id", id).maybeSingle();
    if (error) throw this.toError(error);
    if (!data) throw notFound(resource);
    return data as T;
  }

  async maybeById<T = Row>(table: string, id: string): Promise<T | null> {
    const { data, error } = await this.client.from(table).select("*").eq("id", id).maybeSingle();
    if (error) throw this.toError(error);
    return data as T | null;
  }

  async list<T = Row>(
    table: string,
    options: {
      eq?: Record<string, string | number | boolean | null>;
      in?: Record<string, Array<string | number>>;
      order?: { column: string; ascending?: boolean };
      limit?: number;
      select?: string;
    } = {}
  ): Promise<T[]> {
    let query = this.client.from(table).select(options.select ?? "*");
    for (const [key, value] of Object.entries(options.eq ?? {})) query = query.eq(key, value);
    for (const [key, value] of Object.entries(options.in ?? {})) query = query.in(key, value);
    if (options.order) query = query.order(options.order.column, { ascending: options.order.ascending ?? true });
    if (options.limit) query = query.limit(options.limit);
    const { data, error } = await query;
    if (error) throw this.toError(error);
    return (data ?? []) as T[];
  }

  async update<T = Row>(table: string, id: string, patch: Row, resource = table): Promise<T> {
    const { data, error } = await this.client.from(table).update(patch).eq("id", id).select("*").maybeSingle();
    if (error) throw this.toError(error);
    if (!data) throw notFound(resource);
    return data as T;
  }

  async updateWhere<T = Row>(table: string, eq: Record<string, string>, patch: Row): Promise<T[]> {
    let query = this.client.from(table).update(patch).select("*");
    for (const [key, value] of Object.entries(eq)) query = query.eq(key, value);
    const { data, error } = await query;
    if (error) throw this.toError(error);
    return (data ?? []) as T[];
  }

  async count(table: string, options: { in?: Record<string, string[]> } = {}): Promise<number> {
    let query = this.client.from(table).select("id", { count: "exact", head: true });
    for (const [key, value] of Object.entries(options.in ?? {})) query = query.in(key, value);
    const { count, error } = await query;
    if (error) throw this.toError(error);
    return count ?? 0;
  }

  async rpc<T = Row>(name: string, params: Row): Promise<T> {
    const { data, error } = await this.client.rpc(name, params);
    if (error) throw this.toError(error);
    return data as T;
  }

  async mutate<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }

  private toError(error: { message: string; code?: string; details?: string; hint?: string }): AppError {
    if (error.code === "42P01" || error.message.includes("Could not find the table")) {
      return new AppError(500, "supabase_schema_missing", "Supabase table is missing. Run backend/supabase/schema.sql.", error);
    }
    if (error.code === "PGRST202" || error.message.includes("Could not find the function")) {
      return new AppError(500, "supabase_rpc_missing", "Supabase RPC is missing. Re-run backend/supabase/schema.sql so production atomic purchase finalization is installed.", error);
    }
    return new AppError(500, "supabase_error", error.message, error);
  }
}
