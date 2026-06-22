import type { AnyRow, Product } from "@/lib/types";

export function productLabel(productId: string, products: Product[] = []): string {
  const found = products.find((product) => product.id === productId);
  if (found) return found.name;
  return productId.replace(/^prd_/, "").replace(/_/g, " ");
}

export function agentNameForRun(run: AnyRow, agents: AnyRow[]): string {
  const agent = agents.find((item) => String(item.id) === String(run.agent_id));
  return agent ? String(agent.name) : String(run.agent_id ?? "—");
}

export function runShortId(runId: string): string {
  const id = String(runId);
  return id.length > 18 ? `${id.slice(0, 10)}…${id.slice(-6)}` : id;
}

export function formatRunDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}
