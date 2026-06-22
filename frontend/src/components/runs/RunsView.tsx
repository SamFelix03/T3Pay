"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnyRow, Product } from "@/lib/types";
import { apiGet } from "@/lib/api";
import { agentNameForRun, productLabel } from "@/lib/run-utils";
import { humanizePurchaseReason } from "@/lib/purchase-outcome";
import { timeAgo } from "@/lib/format";
import { EmptyState, StatusChip } from "@/components/ui/primitives";

type Props = {
  userId: string;
  agents: AnyRow[];
  products: Product[];
  onOpenRun: (runId: string) => void;
};

type SortKey = "created_at" | "agent" | "use_case" | "product" | "status" | "confidence";

export function RunsView({ userId, agents, products, onOpenRun }: Props) {
  const [runs, setRuns] = useState<AnyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiGet<{ runs: AnyRow[] }>(`/api/agent-runs?userId=${encodeURIComponent(userId)}`)
      .then((result) => {
        if (!active) return;
        setRuns(result.runs ?? []);
      })
      .catch(() => {
        if (!active) return;
        setRuns([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const sortedRuns = useMemo(() => {
    const next = [...runs];
    next.sort((a, b) => {
      let left: string | number = "";
      let right: string | number = "";
      switch (sortKey) {
        case "agent":
          left = agentNameForRun(a, agents);
          right = agentNameForRun(b, agents);
          break;
        case "use_case":
          left = String(a.use_case ?? "");
          right = String(b.use_case ?? "");
          break;
        case "product":
          left = productLabel(String(a.selected_product_id ?? ""), products);
          right = productLabel(String(b.selected_product_id ?? ""), products);
          break;
        case "status":
          left = String(a.status ?? "");
          right = String(b.status ?? "");
          break;
        case "confidence":
          left = Number(a.confidence ?? 0);
          right = Number(b.confidence ?? 0);
          break;
        default:
          left = new Date(String(a.created_at ?? 0)).getTime();
          right = new Date(String(b.created_at ?? 0)).getTime();
      }
      if (left < right) return sortDir === "asc" ? -1 : 1;
      if (left > right) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return next;
  }, [agents, products, runs, sortDir, sortKey]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "created_at" ? "desc" : "asc");
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return null;
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  if (loading) {
    return <p className="empty-state">Loading runs…</p>;
  }

  if (!runs.length) {
    return <EmptyState text="No agent runs yet. Start one from an agent workspace." />;
  }

  return (
    <div className="view-stack">
      <section className="vp-table-card">
        <div className="vp-table-scroll">
          <table className="vp-table">
            <thead>
              <tr>
                <th>
                  <button type="button" className="vp-table-sort" onClick={() => toggleSort("agent")}>
                    Agent{sortIndicator("agent")}
                  </button>
                </th>
                <th>
                  <button type="button" className="vp-table-sort" onClick={() => toggleSort("use_case")}>
                    Use case{sortIndicator("use_case")}
                  </button>
                </th>
                <th>Objective</th>
                <th>
                  <button type="button" className="vp-table-sort" onClick={() => toggleSort("product")}>
                    Product{sortIndicator("product")}
                  </button>
                </th>
                <th>Merchant</th>
                <th>
                  <button type="button" className="vp-table-sort" onClick={() => toggleSort("status")}>
                    Status{sortIndicator("status")}
                  </button>
                </th>
                <th>Outcome</th>
                <th className="vp-table-align-right">
                  <button type="button" className="vp-table-sort" onClick={() => toggleSort("confidence")}>
                    Confidence{sortIndicator("confidence")}
                  </button>
                </th>
                <th>Model</th>
                <th className="vp-table-align-right">
                  <button type="button" className="vp-table-sort" onClick={() => toggleSort("created_at")}>
                    Date{sortIndicator("created_at")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRuns.map((run) => (
                <tr key={String(run.id)} className="vp-table-row" onClick={() => onOpenRun(String(run.id))}>
                  <td className="vp-table-primary">{agentNameForRun(run, agents)}</td>
                  <td>{String(run.use_case ?? "—")}</td>
                  <td className="vp-table-truncate" title={String(run.objective ?? "")}>
                    {String(run.objective ?? "—")}
                  </td>
                  <td>{productLabel(String(run.selected_product_id ?? ""), products)}</td>
                  <td>{String(run.selected_merchant_id ?? "—").replace(/-/g, " ")}</td>
                  <td>
                    <StatusChip value={String(run.status ?? "unknown")} />
                  </td>
                  <td className="vp-table-truncate" title={humanizePurchaseReason(String(run.decision_reason ?? ""), String(run.status ?? ""))}>
                    {String(run.status) === "approved"
                      ? "—"
                      : humanizePurchaseReason(String(run.decision_reason ?? ""), String(run.status ?? ""))}
                  </td>
                  <td className="vp-table-align-right vp-table-mono">
                    {Math.round(Number(run.confidence ?? 0) * 100)}%
                  </td>
                  <td className="vp-table-muted">{String(run.model ?? "—")}</td>
                  <td className="vp-table-align-right vp-table-muted">{timeAgo(String(run.created_at))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface-card memory-note">
        <span className="section-label">Agent memory</span>
        <p>Visible: product, merchant, price, order ID, receipt ID.</p>
        <p>Never visible: card number, CVC, wallet key, billing data.</p>
      </section>
    </div>
  );
}
