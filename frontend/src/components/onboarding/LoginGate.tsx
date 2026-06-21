"use client";

import { useState } from "react";
import type { VaultPayApp } from "@/hooks/useVaultPayApp";
import { BrandLogo } from "@/components/ui/BrandLogo";

type Props = Pick<VaultPayApp, "signIn" | "signUp" | "busy">;

export function LoginGate({ signIn, signUp, busy }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const canSubmit =
    email.trim().length > 0 &&
    password.length >= 6 &&
    (mode === "signin" || displayName.trim().length > 0);

  async function handleSubmit() {
    if (!canSubmit) return;
    if (mode === "signin") await signIn(email.trim(), password);
    else await signUp(email.trim(), password, displayName.trim());
  }

  return (
    <main className="login-shell">
      <section className="login-card login-card-compact animate-scale-in">
        <div className="login-logo-wrap">
          <BrandLogo variant="hero" />
        </div>

        <div className="login-step">
          <h1 className="login-question">{mode === "signin" ? "Sign in" : "Create account"}</h1>
          <p className="login-lead">
            {mode === "signin"
              ? "Use your email and password to access vaults, agents, and spending policy."
              : "Create an account to get a demo card, USDC wallet, and starter vault automatically."}
          </p>

          {mode === "signup" ? (
            <label>
              Display name
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </label>
          ) : null}

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              onKeyDown={(event) => {
                if (event.key === "Enter" && canSubmit) void handleSubmit();
              }}
            />
          </label>

          <button type="button" className="primary-btn full" onClick={() => void handleSubmit()} disabled={!canSubmit || busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>

          <button
            type="button"
            className="text-btn login-switch-btn"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            disabled={busy}
          >
            {mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}
          </button>
        </div>
      </section>
    </main>
  );
}
