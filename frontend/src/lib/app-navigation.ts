import type { AppView } from "@/lib/types";

export const TAB_PARAM = "tab";
export const AGENT_PARAM = "agent";

const VIEWS: AppView[] = ["dashboard", "agent", "vault", "marketplace", "agents", "runs", "approvals", "receipts"];

export function isAppView(value: string | null | undefined): value is AppView {
  return Boolean(value && VIEWS.includes(value as AppView));
}

export function readViewFromSearchParams(params: URLSearchParams): { view: AppView; agentId: string | null } {
  const tab = params.get(TAB_PARAM);
  const agentId = params.get(AGENT_PARAM);
  if (tab === "agent" && agentId) return { view: "agent", agentId };
  if (isAppView(tab)) return { view: tab, agentId: null };
  return { view: "dashboard", agentId: null };
}

export function buildAppUrl(view: AppView, agentId?: string | null): string {
  const params = new URLSearchParams();
  params.set(TAB_PARAM, view);
  if (view === "agent" && agentId) params.set(AGENT_PARAM, agentId);
  return `?${params.toString()}`;
}
