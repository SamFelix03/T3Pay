import type { AppView } from "@/lib/types";

export const TAB_PARAM = "tab";
export const AGENT_PARAM = "agent";
export const RUN_PARAM = "run";

const VIEWS: AppView[] = ["dashboard", "agent", "vault", "marketplace", "agents", "runs", "run", "approvals", "receipts"];

export function isAppView(value: string | null | undefined): value is AppView {
  return Boolean(value && VIEWS.includes(value as AppView));
}

export function readViewFromSearchParams(params: URLSearchParams): {
  view: AppView;
  agentId: string | null;
  runId: string | null;
} {
  const tab = params.get(TAB_PARAM);
  const agentId = params.get(AGENT_PARAM);
  const runId = params.get(RUN_PARAM);
  if (tab === "agent" && agentId) return { view: "agent", agentId, runId: null };
  if (tab === "run" && runId) return { view: "run", agentId: null, runId };
  if (isAppView(tab)) return { view: tab, agentId: null, runId: null };
  return { view: "dashboard", agentId: null, runId: null };
}

export function buildAppUrl(
  view: AppView,
  options?: { agentId?: string | null; runId?: string | null }
): string {
  const params = new URLSearchParams();
  params.set(TAB_PARAM, view);
  if (view === "agent" && options?.agentId) params.set(AGENT_PARAM, options.agentId);
  if (view === "run" && options?.runId) params.set(RUN_PARAM, options.runId);
  return `?${params.toString()}`;
}
