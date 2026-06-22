"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnyRow, Product } from "@/lib/types";
import { apiGet } from "@/lib/api";
import { productLabel } from "@/lib/run-utils";
import { money, short, timeAgo } from "@/lib/format";
import { EmptyState, StatusChip } from "@/components/ui/primitives";
import { ReceiptDetailModal, type ReceiptSummary } from "@/components/receipts/ReceiptDetailModal";

type ReceiptRow = ReceiptSummary;

type Props = {
  userId: string;
  products: Product[];
  onVerify: (id: string) => Promise<AnyRow | null>;
  busy: boolean;
};

type SortKey = "createdAt" | "agentName" | "productId" | "merchantId" | "amountCents" | "receiptType";

export function ReceiptsView({ userId, products, onVerify, busy }: Props) {
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiGet<{ receipts: ReceiptRow[] }>(`/api/receipts?userId=${encodeURIComponent(userId)}`)
      .then((result) => {
        if (!active) return;
        setReceipts(result.receipts ?? []);
      })
      .catch(() => {
        if (!active) return;
        setReceipts([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const sortedReceipts = useMemo(() => {
    const next = [...receipts];
    next.sort((a, b) => {
      let left: string | number = "";
      let right: string | number = "";
      switch (sortKey) {
        case "agentName":
          left = a.agentName;
          right = b.agentName;
          break;
        case "productId":
          left = productLabel(a.productId, products);
          right = productLabel(b.productId, products);
          break;
        case "merchantId":
          left = a.merchantId;
          right = b.merchantId;
          break;
        case "amountCents":
          left = a.amountCents;
          right = b.amountCents;
          break;
        case "receiptType":
          left = a.receiptType;
          right = b.receiptType;
          break;
        default:
          left = new Date(a.createdAt).getTime();
          right = new Date(b.createdAt).getTime();
      }
      if (left < right) return sortDir === "asc" ? -1 : 1;
      if (left > right) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return next;
  }, [products, receipts, sortDir, sortKey]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "createdAt" ? "desc" : "asc");
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return null;
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  async function handleVerify(id: string) {
    const verified = await onVerify(id);
    if (verified) {
      setReceipts((current) =>
        current.map((row) => (row.id === id ? { ...row, receiptHash: String(verified.receiptHash ?? row.receiptHash) } : row))
      );
    }
    return verified;
  }

  if (loading) {
    return <p className="empty-state">Loading receipts…</p>;
  }

  if (!receipts.length) {
    return <EmptyState text="Complete a purchase to view receipt proof." />;
  }

  const selectedReceipt = selectedId ? receipts.find((row) => row.id === selectedId) ?? null : null;

  return (
    <>
      <div className="view-stack">
        <section className="vp-table-card">
          <div className="vp-table-scroll">
            <table className="vp-table">
              <thead>
                <tr>
                  <th>
                    <button type="button" className="vp-table-sort" onClick={() => toggleSort("createdAt")}>
                      Date{sortIndicator("createdAt")}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="vp-table-sort" onClick={() => toggleSort("agentName")}>
                      Agent{sortIndicator("agentName")}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="vp-table-sort" onClick={() => toggleSort("productId")}>
                      Product{sortIndicator("productId")}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="vp-table-sort" onClick={() => toggleSort("merchantId")}>
                      Merchant{sortIndicator("merchantId")}
                    </button>
                  </th>
                  <th className="vp-table-align-right">
                    <button type="button" className="vp-table-sort" onClick={() => toggleSort("amountCents")}>
                      Amount{sortIndicator("amountCents")}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="vp-table-sort" onClick={() => toggleSort("receiptType")}>
                      Type{sortIndicator("receiptType")}
                    </button>
                  </th>
                  <th>Receipt</th>
                  <th>Order</th>
                </tr>
              </thead>
              <tbody>
                {sortedReceipts.map((receipt) => (
                  <tr
                    key={receipt.id}
                    className="vp-table-row"
                    onClick={() => setSelectedId(receipt.id)}
                  >
                    <td className="vp-table-muted">{timeAgo(receipt.createdAt)}</td>
                    <td className="vp-table-primary">{receipt.agentName}</td>
                    <td>{productLabel(receipt.productId, products)}</td>
                    <td>{receipt.merchantId.replace(/-/g, " ")}</td>
                    <td className="vp-table-align-right vp-table-mono">{money(receipt.amountCents)}</td>
                    <td>
                      <StatusChip value={receipt.receiptType} />
                    </td>
                    <td className="vp-table-mono vp-table-muted">{short(receipt.id, 20)}</td>
                    <td className="vp-table-mono vp-table-muted">{receipt.orderId ? short(receipt.orderId, 18) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="surface-card memory-note">
          <span className="section-label">Receipt proof</span>
          <p>Each row links purchase attempt, mandate hash, and T3N contract receipt inside the stored payload.</p>
          <p>Never visible: card number, CVC, wallet key, billing data.</p>
        </section>
      </div>

      <ReceiptDetailModal
        open={Boolean(selectedId)}
        receiptId={selectedId}
        summary={selectedReceipt}
        products={products}
        busy={busy}
        onClose={() => setSelectedId(null)}
        onVerify={handleVerify}
      />
    </>
  );
}
