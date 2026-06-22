"use client";

import { useEffect, useState } from "react";
import type { AnyRow, Product } from "@/lib/types";
import { apiGet } from "@/lib/api";
import { formatRunDate, productLabel, runShortId } from "@/lib/run-utils";
import { money, short } from "@/lib/format";
import { StatusChip } from "@/components/ui/primitives";
import { ModalPortal } from "@/components/ui/ModalPortal";

export type ReceiptSummary = {
  id: string;
  purchaseAttemptId: string;
  receiptHash: string;
  receiptType: string;
  createdAt: string;
  agentId: string;
  agentName: string;
  merchantId: string;
  productId: string;
  amountCents: number;
  currency: string;
  orderId: string | null;
  mandateId: string;
};

type Props = {
  open: boolean;
  receiptId: string | null;
  summary: ReceiptSummary | null;
  products: Product[];
  busy: boolean;
  onClose: () => void;
  onVerify: (id: string) => Promise<AnyRow | null>;
};

function JsonBlock({ value }: { value: unknown }) {
  if (!value || (typeof value === "object" && !Object.keys(value as object).length)) {
    return <p className="empty-state">No data recorded.</p>;
  }
  return <pre className="receipt-detail-json">{JSON.stringify(value, null, 2)}</pre>;
}

export function ReceiptDetailModal({ open, receiptId, summary, products, busy, onClose, onVerify }: Props) {
  const [receipt, setReceipt] = useState<AnyRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !receiptId) {
      setReceipt(null);
      setError(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    apiGet<{ receipt: AnyRow }>(`/api/receipts/${receiptId}`)
      .then((result) => {
        if (!active) return;
        setReceipt(result.receipt ?? null);
      })
      .catch((err) => {
        if (!active) return;
        setError((err as Error).message);
        setReceipt(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, receiptId]);

  if (!open || !receiptId) return null;

  const payload = (receipt?.payload as Record<string, unknown> | undefined) ?? {};
  const contractReceipt = payload.contractReceipt as Record<string, unknown> | undefined;
  const displayProduct = summary ? productLabel(summary.productId, products) : "Purchase receipt";

  async function handleVerify() {
    if (!receiptId) return;
    const verified = await onVerify(receiptId);
    if (verified) setReceipt(verified);
  }

  return (
    <ModalPortal>
      <div className="modal-overlay" onClick={onClose} role="presentation">
        <div
          className="modal-panel receipt-detail-modal"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Receipt details"
        >
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>

          {loading ? <p className="empty-state">Loading receipt…</p> : null}
          {error ? <p className="empty-state">{error}</p> : null}

          {!loading && !error && receipt ? (
            <div className="receipt-detail-body">
              <header className="receipt-detail-header">
                <div>
                  <span className="section-label">Receipt</span>
                  <h2 className="receipt-detail-title">{runShortId(String(receipt.id))}</h2>
                  <p className="receipt-detail-subtitle">
                    {displayProduct} · {summary?.agentName ?? "Agent"} · {formatRunDate(String(receipt.createdAt))}
                  </p>
                </div>
                <StatusChip value={receipt.valid ? "verified" : "stored"} />
              </header>

              <div className="metric-grid receipt-detail-metrics">
                <article className="metric-tile">
                  <span>Amount</span>
                  <strong>{money(Number(payload.amountCents ?? 0))}</strong>
                </article>
                <article className="metric-tile">
                  <span>Merchant</span>
                  <strong>{String(payload.merchantId ?? "—").replace(/-/g, " ")}</strong>
                </article>
              </div>

              <section className="receipt-detail-section">
                <span className="section-label">Identifiers</span>
                <div className="metric-grid receipt-detail-identifiers">
                  <article className="metric-tile">
                    <span>Receipt hash</span>
                    <strong className="receipt-detail-mono" title={String(receipt.receiptHash)}>
                      {short(String(receipt.receiptHash), 22)}
                    </strong>
                  </article>
                  <article className="metric-tile">
                    <span>Purchase attempt</span>
                    <strong className="receipt-detail-mono" title={String(payload.purchaseAttemptId ?? "")}>
                      {short(String(payload.purchaseAttemptId ?? "—"), 22)}
                    </strong>
                  </article>
                  <article className="metric-tile">
                    <span>Mandate</span>
                    <strong className="receipt-detail-mono" title={String(payload.mandateId ?? "")}>
                      {short(String(payload.mandateId ?? "—"), 22)}
                    </strong>
                  </article>
                  <article className="metric-tile">
                    <span>Agent</span>
                    <strong className="receipt-detail-mono" title={String(payload.agentId ?? "")}>
                      {short(String(payload.agentId ?? "—"), 22)}
                    </strong>
                  </article>
                  <article className="metric-tile">
                    <span>Mandate hash (T3N)</span>
                    <strong className="receipt-detail-mono" title={String(payload.mandateHash ?? "")}>
                      {short(String(payload.mandateHash ?? "—"), 22)}
                    </strong>
                  </article>
                </div>
              </section>

              <section className="receipt-detail-section">
                <span className="section-label">T3N contract receipt</span>
                <p className="receipt-detail-note">
                  Compact receipt record issued through the VaultPay T3N contract and embedded in this payload.
                </p>
                <JsonBlock value={contractReceipt} />
              </section>

              <section className="receipt-detail-section">
                <span className="section-label">Stored payload</span>
                <p className="receipt-detail-note">
                  Verification checks that this payload hashes to the stored receipt hash. Signed SD-JWT receipts are not
                  available on the current testnet.
                </p>
                <JsonBlock value={payload} />
              </section>

              <div className="receipt-detail-actions">
                <button type="button" className="primary-btn" onClick={() => void handleVerify()} disabled={busy}>
                  {busy ? "Verifying…" : "Verify integrity"}
                </button>
                <button type="button" className="ghost-btn" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </ModalPortal>
  );
}
