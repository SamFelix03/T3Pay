import type { AnyRow } from "./types";

const API_BASE = "/api/t3pay";

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  return parseResponse<T>(response);
}

export async function apiPost<T = AnyRow>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return parseResponse<T>(response);
}

async function parseResponse<T>(response: Response): Promise<T> {
  const json = await response.json();
  if (!response.ok) throw new Error(String(json.message ?? json.error ?? "Request failed"));
  return json as T;
}
