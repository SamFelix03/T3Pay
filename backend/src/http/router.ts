import http from "node:http";
import { URL } from "node:url";
import { ZodSchema } from "zod";
import { AppContext, Handler, Route } from "./types";
import { AppError, badRequest } from "../domain/errors";
import { sanitize } from "../domain/redaction";

export class Router {
  private readonly routes: Route[] = [];

  add(method: string, path: string, handler: Handler): void {
    const { pattern, keys } = compilePath(path);
    this.routes.push({ method, pattern, keys, handler });
  }

  get(path: string, handler: Handler): void {
    this.add("GET", path, handler);
  }

  post(path: string, handler: Handler): void {
    this.add("POST", path, handler);
  }

  patch(path: string, handler: Handler): void {
    this.add("PATCH", path, handler);
  }

  head(path: string, handler: Handler): void {
    this.add("HEAD", path, handler);
  }

  handler(app: AppContext): http.RequestListener {
    return async (req, res) => {
      try {
        const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
        const match = this.match(req.method ?? "GET", url.pathname);
        if (!match) return sendJson(res, 404, { error: "not_found", message: "route not found" });
        const result = await match.route.handler({ req, res, url, params: match.params, app });
        if (!res.writableEnded) sendJson(res, 200, result ?? { ok: true });
      } catch (error) {
        handleError(res, error);
      }
    };
  }

  private match(method: string, pathname: string): { route: Route; params: Record<string, string> } | undefined {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = pathname.match(route.pattern);
      if (!match) continue;
      const params = Object.fromEntries(route.keys.map((key, index) => [key, decodeURIComponent(match[index + 1])]));
      return { route, params };
    }
    return undefined;
  }
}

export async function readJson<T>(req: http.IncomingMessage, schema: ZodSchema<T>): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8") || "{}";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw badRequest("request body must be valid JSON");
  }
  const result = schema.safeParse(parsed);
  if (!result.success) throw badRequest("request body failed validation", result.error.flatten());
  return result.data;
}

export function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(sanitize(body), null, 2));
}

export function sendHead(res: http.ServerResponse, status: number): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end();
}

function handleError(res: http.ServerResponse, error: unknown): void {
  if (error instanceof AppError) {
    return sendJson(res, error.status, { error: error.code, message: error.message, details: error.details });
  }
  const message = error instanceof Error ? error.message : String(error);
  return sendJson(res, 500, { error: "server_error", message });
}

function compilePath(path: string): { pattern: RegExp; keys: string[] } {
  const keys: string[] = [];
  const source = path
    .split("/")
    .map((part) => {
      if (!part.startsWith(":")) return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      keys.push(part.slice(1));
      return "([^/]+)";
    })
    .join("/");
  return { pattern: new RegExp(`^${source}$`), keys };
}
