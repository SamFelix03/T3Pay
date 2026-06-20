"use client";

import type { ReactNode } from "react";
import type { AppView, AssetModal } from "@/lib/types";
import { BrandLogo } from "@/components/ui/BrandLogo";

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function VaultIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function BotIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  );
}

function RunIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function ApprovalIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16l4-2 4 2 4-2 4 2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </svg>
  );
}

const PILL_1: Array<{ id: AppView; label: string; icon: () => ReactNode }> = [
  { id: "dashboard", label: "Dashboard", icon: HomeIcon },
  { id: "vault", label: "Vault", icon: VaultIcon }
];

const PILL_2: Array<{ id: AppView; label: string; icon: () => ReactNode }> = [
  { id: "agents", label: "Agents", icon: BotIcon },
  { id: "runs", label: "Runs", icon: RunIcon },
  { id: "approvals", label: "Approvals", icon: ApprovalIcon },
  { id: "receipts", label: "Receipts", icon: ReceiptIcon }
];

type Props = {
  view: AppView;
  onViewChange: (view: AppView) => void;
  onAssetOpen: (asset: AssetModal) => void;
  onRefresh: () => void;
  busy: boolean;
  pendingApprovals: number;
};

export function AppNavbar({ view, onViewChange, onAssetOpen, onRefresh, busy, pendingApprovals }: Props) {
  return (
    <header className="app-navbar">
      <div className="navbar-inner">
        <div className="navbar-left">
          <button type="button" className="brand-button" onClick={() => onViewChange("dashboard")} aria-label="T3Pay home">
            <BrandLogo variant="nav" />
          </button>

          <div className="nav-pill">
            {PILL_1.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                title={label}
                className={`nav-pill-btn ${view === id ? "active" : ""}`}
                onClick={() => onViewChange(id)}
              >
                <Icon />
              </button>
            ))}
          </div>

          <div className="nav-pill">
            {PILL_2.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                title={label}
                className={`nav-pill-btn ${view === id ? "active" : ""}`}
                onClick={() => onViewChange(id)}
              >
                <Icon />
                {id === "approvals" && pendingApprovals > 0 ? <span className="nav-badge">{pendingApprovals}</span> : null}
              </button>
            ))}
          </div>
        </div>

        <div className="navbar-right">
          <div className="network-pill">
            <span className="live-dot" />
            <span>T3N live</span>
          </div>

          <div className="nav-pill asset-pill">
            <button type="button" className="asset-btn" onClick={() => onAssetOpen("card")}>
              <CardIcon />
              <span>Card</span>
            </button>
            <button type="button" className="asset-btn" onClick={() => onAssetOpen("wallet")}>
              <WalletIcon />
              <span>Wallet</span>
            </button>
          </div>

          <button type="button" className="ghost-btn" onClick={onRefresh} disabled={busy}>
            Refresh
          </button>
        </div>
      </div>
    </header>
  );
}
