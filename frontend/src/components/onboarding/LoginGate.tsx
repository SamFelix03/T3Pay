"use client";

import type { VaultPayApp } from "@/hooks/useVaultPayApp";
import { BrandLogo } from "@/components/ui/BrandLogo";

type Props = Pick<VaultPayApp, "displayName" | "setDisplayName" | "login" | "busy">;

export function LoginGate({ displayName, setDisplayName, login, busy }: Props) {
  const canContinue = displayName.trim().length > 0;

  return (
    <main className="login-shell">
      <section className="login-card login-card-compact animate-scale-in">
        <div className="login-logo-wrap">
          <BrandLogo variant="hero" />
        </div>

        <div className="login-step">
          <h1 className="login-question">Your Name</h1>
          <p className="login-lead">Sign in to manage vaults, agents, and spending policy.</p>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Enter your name"
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter" && canContinue) login(displayName);
            }}
          />
          <button
            type="button"
            className="primary-btn full"
            onClick={() => login(displayName)}
            disabled={!canContinue || busy}
          >
            {busy ? "Signing in…" : "Continue"}
          </button>
        </div>
      </section>
    </main>
  );
}
