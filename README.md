<div align="center">

<!-- Replace src below with your logo path or URL -->
<img width="428" height="187" alt="logo" src="https://github.com/user-attachments/assets/50337c1d-fc56-4c13-a4e0-53605d384cb1" />

# T3Pay

</div>

**T3Pay** is a platform to **create and run personal agents** — powered by [Terminal 3 (T3N)](https://terminal3.io). Spin up a *Shopping Agent* (or Travel, Subscription, and more), fund it from your vault, set a budget and rules, then chat with it to find and buy things for real. The gap it closes: between *asking* an AI to purchase something and actually letting it checkout. Agents get **card or stablecoin** spending power capped to your merchants and categories — they **place orders, hit limits, and route approvals without ever seeing your credentials**. Your rules live in sealed mandates, enforcement runs in the TEE, and every attempt leaves an auditable trail you can prove.

Check out how Terminal 3's Agent Dev Kit and T3N power your agents at [this section](https://github.com/SamFelix03/T3Pay/blob/main/README.md#how-terminal-3-powers-t3pay).

---

## Table of contents

1. [Important links](https://github.com/SamFelix03/T3Pay/blob/main/README.md#important-links)
2. [Bug reports](https://github.com/SamFelix03/T3Pay/blob/main/README.md#bug-reports)
3. [How to demo](https://github.com/SamFelix03/T3Pay/blob/main/README.md#how-to-demo)
4. [The problem](https://github.com/SamFelix03/T3Pay/blob/main/README.md#the-problem)
5. [Introduction](https://github.com/SamFelix03/T3Pay/blob/main/README.md#introduction)
6. [How it all works](https://github.com/SamFelix03/T3Pay/blob/main/README.md#how-it-all-works)
7. [How Terminal 3 powers T3Pay](https://github.com/SamFelix03/T3Pay/blob/main/README.md#how-terminal-3-powers-t3pay)
8. [Conclusion](https://github.com/SamFelix03/T3Pay/blob/main/README.md#conclusion)

---

## Important links

| Resource | Link |
|---|---|
| **Live app** | [View Here](https://t3pay.vercel.app) |
| **Demo video** | [View Here](https://www.youtube.com/watch?v=ssX6L3SSbLY) |
| **Pitch deck** | [View Here](https://canva.link/1w5mzd1ehprryvv) |
| **T3N / ADK bug summary** | [`issues/bug-summary.md`](https://github.com/SamFelix03/T3Pay/blob/main/issues/bug-summary.md) |

## Bug reports

While building T3Pay on Terminal 3, I identified **7 bugs** and **8 documentation gaps** in the T3N platform, SDK, and official docs. Each item includes severity, T3Pay impact, workarounds, and a verification audit against the published documentation. The full list is in [`issues/bug-summary.md`](https://github.com/SamFelix03/T3Pay/blob/main/issues/bug-summary.md).

### Contracts & T3N artifacts

| Artifact | Version | Description | Path |
|---|---|---|---|
| VaultPay WASM contract | `0.2.1` | Rust → WASM tenant contract (mandates, policy, receipts) | [`contracts/vaultpay/src/vaultpay.rs`](https://github.com/SamFelix03/T3Pay/blob/main/contracts/vaultpay/src/vaultpay.rs) |
| Contract exports / WIT bindings | `0.2.1` | WIT `contracts` interface surface | [`contracts/vaultpay/src/lib.rs`](https://github.com/SamFelix03/T3Pay/blob/main/contracts/vaultpay/src/lib.rs) |
| Contract data model | — | Compact mandate / approval / receipt types | [`contracts/vaultpay/src/model.rs`](https://github.com/SamFelix03/T3Pay/blob/main/contracts/vaultpay/src/model.rs) |
| WIT world | `0.1.0` | Imports: `kv-store`, `http`, `http-with-placeholders` | [`contracts/vaultpay/wit/world.wit`](https://github.com/SamFelix03/T3Pay/blob/main/contracts/vaultpay/wit/world.wit) |
| Build script | — | `wasm32-wasip2` release build | [`scripts/build-contracts.sh`](https://github.com/SamFelix03/T3Pay/blob/main/scripts/build-contracts.sh) |
| Register on T3N | — | `tenant.contracts.register` | [`scripts/register-contracts.mjs`](https://github.com/SamFelix03/T3Pay/blob/main/scripts/register-contracts.mjs) |
| Contract invoke smoke | — | `create-mandate`, `read-mandate`, `validate-and-pay` | [`scripts/invoke-contract-demo.mjs`](https://github.com/SamFelix03/T3Pay/blob/main/scripts/invoke-contract-demo.mjs) |
| KV map smoke | — | `map-entry-set` for mandates/secrets | [`scripts/map-smoke.mjs`](https://github.com/SamFelix03/T3Pay/blob/main/scripts/map-smoke.mjs) |
| Seed payment secrets | — | Demo credential refs in `z:<tid>:secrets` | [`scripts/seed-secrets.mjs`](https://github.com/SamFelix03/T3Pay/blob/main/scripts/seed-secrets.mjs) |
| E2E API proof | — | Full T3N-backed demo + revocation | [`scripts/e2e-api.mjs`](https://github.com/SamFelix03/T3Pay/blob/main/scripts/e2e-api.mjs) |
| T3N KV issue notes | — | `map-entry-set` size limits & workarounds | [`issues/t3n-kv-map-entry-set-and-contract-kv-put-500.md`](https://github.com/SamFelix03/T3Pay/blob/main/issues/t3n-kv-map-entry-set-and-contract-kv-put-500.md) |

### T3N map tails (tenant KV)

Defined in [`backend/src/config/constants.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/config/constants.ts#L16-L23):

| Map tail | Purpose |
|---|---|
| `secrets` | Payment credential placeholder refs |
| `mandates` | Sealed spending mandates |
| `agent_roles` | Role assignments |
| `audit` | Compact decision hashes (when native audit insufficient) |
| `receipts` | Receipt record refs |
| `approvals` | Pending approval payloads |

---

## How to demo

Walk through the live app at **[t3pay.vercel.app](https://t3pay.vercel.app)** — create a vault, launch a shopping agent, and let it buy for you.

### 1. Sign in

<!-- screenshot: login / welcome -->
<img width="1512" height="949" alt="Screenshot 2026-06-22 at 7 44 12 PM" src="https://github.com/user-attachments/assets/ce164fb5-f788-475a-97b9-e325eef31fee" />

Create an account or sign in to open your dashboard.

### 2. Create your first vault

<!-- screenshot: vault creation -->
<img width="1512" height="949" alt="Screenshot 2026-06-22 at 7 44 55 PM" src="https://github.com/user-attachments/assets/c4af6f3a-e053-48ba-b184-8d621e7773aa" />

Add a demo card or wallet and create a vault to fund your agents.

### 3. Create your first agent

<!-- screenshot: create agent -->
<img width="1066" height="693" alt="Screenshot 2026-06-22 at 7 46 08 PM" src="https://github.com/user-attachments/assets/4192c07c-d5ae-44bc-882e-8cdab8d02cff" />

Pick a role, set a spending budget and limits, and launch your agent.

### 4. Ask the agent to buy something

<!-- screenshot: agent chat -->
<img width="1331" height="848" alt="Screenshot 2026-06-22 at 7 47 16 PM" src="https://github.com/user-attachments/assets/7ef8eaa2-78c4-40f5-b42f-e57ab66fa333" />

Open the agent workspace and ask it to find and purchase an item — e.g. *"Find a USB-C charger under $50."*

### 5. Purchase succeeds — review the proof

<!-- screenshot: success + runs / receipts -->
<img width="1331" height="848" alt="Screenshot 2026-06-22 at 7 47 53 PM" src="https://github.com/user-attachments/assets/e9d70f50-1efe-4209-8e72-c1c21bd3c542" />

<img width="1331" height="848" alt="Screenshot 2026-06-22 at 7 48 01 PM" src="https://github.com/user-attachments/assets/a0d08c63-8ca5-43af-8eee-1fc77254d1ea" />

When the item is within your rules, the purchase completes. Check **Runs**, **Receipts**, and activity for the full audit trail.

### 6. Over-budget purchases are blocked

<!-- screenshot: purchase blocked -->
<img width="1331" height="848" alt="Screenshot 2026-06-22 at 7 48 34 PM" src="https://github.com/user-attachments/assets/21d06616-e73a-4e39-996e-a539f1cace28" />

Try something above your budget or per-purchase limit (e.g. a $260 laptop on a $150 cap). The agent can still propose it — T3Pay rejects the checkout and shows why.

### 7. Revoked agents lose access

<!-- screenshot: revoke + blocked purchase -->
<img width="1331" height="848" alt="Screenshot 2026-06-22 at 7 49 20 PM" src="https://github.com/user-attachments/assets/670e2043-46d4-48f0-8520-43cb3b7b964a" />

Revoke the agent from your dashboard, then try another purchase. Access is denied immediately — no silent spending after you pull the plug.

---

## The problem

People want to **create AI agents that buy stuff for them** — but agentic commerce has a **trust gap**. You do not want those agents holding raw card numbers, wallet keys, or unlimited spending authority while they browse, compare, and checkout on your behalf.

### What goes wrong today

1. **Credentials sit too close to the agent.** Prompt injection or tool misuse can exfiltrate everything in the agent's context.
2. **Spending limits are promises, not proofs.** Saying "spend up to $200" rarely comes with cryptographic evidence the limit was enforced.
3. **Delegated identity is weak.** Merchants cannot reliably tell a user-authorized agent from rogue automation.
4. **Individuals lack a control center.** There is no single place to assign roles, approve sensitive buys, review blocks, and revoke access.
5. **Audit trails are thin.** When something goes wrong, you cannot reconstruct mandate → agent DID → policy decision → outcome.

### A concrete case study

**Maya** uses a generic shopping agent with her card API key in the tool config. The agent buys a $29 charger—fine. Later, a injected prompt tricks it into attempting a $260 laptop and exfiltrating her billing profile. She has no cryptographic receipt, no per-purchase ceiling enforced in the TEE, and no one-click revoke that actually kills the delegation on the network.

**With T3Pay:** Maya seals a demo card and wallet in her vault, creates a *Shopping Agent* with its **own T3N DID**, and signs a scoped ADK grant (`validate-and-pay` only, approved merchants/hosts). The agent proposes any catalog item—including the $260 laptop—but T3N **rejects** over-limit attempts, logs the decision, and never returns credentials to the agent. Maya sees approved, rejected, and pending actions on her dashboard and revokes the grant in one action.

---

## Introduction

T3Pay is a **platform for creating and using governed agents** — starting with **Shopping Agents** that search a product catalog, propose purchases in chat, and checkout within your rules. Under the hood it combines **private payment execution** with **personal agent governance** on T3N:

- **You** — create vaults, spin up agents, set mandates, monitor every run, and revoke access in one click.
- **Your agent** — separate T3N DID per agent; scoped delegation to shop and pay, never your credentials.
- **TEE / T3N** — seals secrets, enforces policy at checkout, and records an auditable outcome for every attempt.

### Agent types you can create today

| Role | What it does |
|---|---|
| **Shopping** | Browse catalog, propose products, purchase within budget |
| **Travel** | Book trips within merchant and spend limits |
| **Subscription** | Manage recurring purchases |
| **Research-only** | Search and recommend — no checkout |
| **Custom** | Your own scope and limits |

Roles are configured in [`backend/src/config/constants.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/config/constants.ts#L25). Each agent gets its own workspace, chat, and spending mandate.

### Core user flow

1. Create a **private vault** with demo card and/or USDC wallet — [`backend/src/modules/vaults/routes.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/vaults/routes.ts)
2. **Create your first agent** (e.g. Shopping Agent) — [`backend/src/modules/agents/routes.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/agents/routes.ts#L31-L65)
3. Assign a **role** and spending limits — [`backend/src/config/constants.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/config/constants.ts#L25)
4. Seal a **spending mandate** (budget, merchants, categories, limits, expiry) — [`backend/src/modules/mandates/routes.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/mandates/routes.ts)
5. Agent requests purchase via chat or run — [`backend/src/modules/agent-chat/`](https://github.com/SamFelix03/T3Pay/tree/main/backend/src/modules/agent-chat/) + [`backend/src/modules/agent-runs/`](https://github.com/SamFelix03/T3Pay/tree/main/backend/src/modules/agent-runs/)
6. TEE validates and executes (or rejects / pending) — [`backend/src/modules/t3n/gateway.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts)
7. User monitors dashboard, runs, receipts, approvals — [`frontend/src/components/dashboard/`](https://github.com/SamFelix03/T3Pay/tree/main/frontend/src/components/dashboard/)

### Policy decisions

Every attempt ends in one of: `approved` · `rejected` · `pending_approval` · `revoked` · `expired` — [`backend/src/config/constants.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/config/constants.ts#L28).

---

## How it all works

End-to-end architecture: **Next.js UI** → **Node API** → **T3N SDK + WASM contract** → **Merchant settlement** (local Stripe-style rail; no official T3 test merchant exists).
<div align="center">
<img width="677" height="621" alt="Screenshot 2026-06-22 at 4 53 04 PM" src="https://github.com/user-attachments/assets/bc400c8f-3dba-409b-a80d-5f47a6ee5c54" />
</div>

```
User ──► App (Next.js) ──► API (Node) ──► T3N TenantClient / T3nClient
                              │                    │
                              │                    ├── WASM validate-and-pay
                              │                    ├── agent-auth grants
                              │                    └── KV maps (mandates, secrets…)
                              ▼
                         Supabase (projections)
                              │
                              ▼
                    Merchant checkout (balances, orders)
```

### 1. Frontend shell & navigation

| Concern | Implementation |
|---|---|
| App entry | [`frontend/src/app/page.tsx`](https://github.com/SamFelix03/T3Pay/blob/main/frontend/src/app/page.tsx) → [`frontend/src/components/layout/AppShell.tsx`](https://github.com/SamFelix03/T3Pay/blob/main/frontend/src/components/layout/AppShell.tsx) |
| URL-driven views (dashboard, agent, runs, vault…) | [`frontend/src/lib/app-navigation.ts`](https://github.com/SamFelix03/T3Pay/blob/main/frontend/src/lib/app-navigation.ts) + [`AppShell.tsx`](https://github.com/SamFelix03/T3Pay/blob/main/frontend/src/components/layout/AppShell.tsx#L57-L70) |
| Global state & API orchestration | [`frontend/src/hooks/useVaultPayApp.ts`](https://github.com/SamFelix03/T3Pay/blob/main/frontend/src/hooks/useVaultPayApp.ts) |
| API proxy to backend | [`frontend/src/app/api/t3pay/[...path]/route.ts`](https://github.com/SamFelix03/T3Pay/blob/main/frontend/src/app/api/t3pay/%5B...path%5D/route.ts) |

### 2. Authentication & session

| Step | Code |
|---|---|
| Supabase email auth gate | [`frontend/src/components/onboarding/LoginGate.tsx`](https://github.com/SamFelix03/T3Pay/blob/main/frontend/src/components/onboarding/LoginGate.tsx) |
| Session bootstrap | [`backend/src/modules/users/routes.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/users/routes.ts) |
| Demo welcome onboarding | [`frontend/src/components/onboarding/DemoWelcomeModal.tsx`](https://github.com/SamFelix03/T3Pay/blob/main/frontend/src/components/onboarding/DemoWelcomeModal.tsx) |

### 3. Vaults & payment methods

| Step | Code |
|---|---|
| Create vault | [`backend/src/modules/vaults/routes.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/vaults/routes.ts#L21-L28) |
| Issue demo card / wallet (`t3n_secret_ref` per method) | [`backend/src/modules/vaults/routes.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/vaults/routes.ts#L37-L64) |
| Attach existing instrument (no duplication) | [`backend/src/modules/vaults/routes.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/vaults/routes.ts#L66-L86) |
| Card/wallet modals (preview only, no raw secrets) | [`frontend/src/components/vault/AssetHubModal.tsx`](https://github.com/SamFelix03/T3Pay/blob/main/frontend/src/components/vault/AssetHubModal.tsx) |

### 4. Agents, mandates & ADK grants

Creating an agent is a **two-step API flow** from the UI:

1. `POST /api/agents` — derive or link T3N agent DID — [`useVaultPayApp.ts`](https://github.com/SamFelix03/T3Pay/blob/main/frontend/src/hooks/useVaultPayApp.ts#L399-L405) · [`agents/routes.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/agents/routes.ts#L39-L41) · [`gateway.ts#createAgentIdentity`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L245-L260)
2. `POST /api/mandates` — seal mandate on T3N + create ADK grant — [`useVaultPayApp.ts`](https://github.com/SamFelix03/T3Pay/blob/main/frontend/src/hooks/useVaultPayApp.ts#L407-L419) · [`mandates/routes.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/mandates/routes.ts#L48-L60) · [`gateway.ts#createAgentGrant`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L263-L392)

Revocation calls `revokeDelegation` on T3N and revokes mandates — [`agents/routes.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/agents/routes.ts#L102-L119).

### 5. Agent chat (Groq)

| Step | Code |
|---|---|
| Load **full** product catalog (no pre-filter) | [`backend/src/modules/catalog/products.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/catalog/products.ts) |
| Groq role-scoped chat + proposals | [`backend/src/modules/agent-chat/groq-chat.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/agent-chat/groq-chat.ts) |
| Chat API | [`backend/src/modules/agent-chat/service.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/agent-chat/service.ts) |
| Chat UI + example prompts | [`frontend/src/components/agents/chat/AgentChatPanel.tsx`](https://github.com/SamFelix03/T3Pay/blob/main/frontend/src/components/agents/chat/AgentChatPanel.tsx) |

### 6. Agent runs (Groq selection → T3N policy)

| Step | Code |
|---|---|
| `POST /api/agent-runs` | [`backend/src/modules/agent-runs/routes.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/agent-runs/routes.ts#L47-L52) |
| Load catalog → user-selected product **or** Groq pick | [`backend/src/modules/agent-runs/run-flow.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/agent-runs/run-flow.ts#L128-L195) |
| Agent DID auth + delegated `validate-and-pay` | [`run-flow.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/agent-runs/run-flow.ts#L107-L243) · [`gateway.ts#validateAndPayAsAgent`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L146-L243) |
| Groq product selection | [`backend/src/modules/agent-runs/groq.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/agent-runs/groq.ts) |
| Persist run + trace | [`run-flow.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/agent-runs/run-flow.ts#L249-L299) |
| Run detail / candidate table / policy outcome | [`frontend/src/components/runs/RunDetailView.tsx`](https://github.com/SamFelix03/T3Pay/blob/main/frontend/src/components/runs/RunDetailView.tsx) |
| Live trace panel | [`frontend/src/components/agents/RunTracePanel.tsx`](https://github.com/SamFelix03/T3Pay/blob/main/frontend/src/components/agents/RunTracePanel.tsx) |

### 7. Settlement & merchant boundary

| Step | Code |
|---|---|
| Policy decision applied | [`backend/src/modules/tasks/service.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/tasks/service.ts#L26-L114) |
| Approved path: T3N budget update + mock checkout + receipt | [`tasks/service.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/tasks/service.ts#L202-L296) |
| Mock merchant catalog & checkout | [`backend/src/modules/merchant/service.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/merchant/service.ts) |
| Atomic finalize (Postgres RPC) | [`backend/supabase/schema.sql`](https://github.com/SamFelix03/T3Pay/blob/main/backend/supabase/schema.sql) (`vaultpay_finalize_purchase`) |

Rejected / pending paths record `purchase_attempts` without deducting budget — [`tasks/service.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/tasks/service.ts#L75-L113).

### 8. Approvals

| Step | Code |
|---|---|
| T3N `create-approval-request` on threshold breach | [`gateway.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L428-L433) · [`tasks/service.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/tasks/service.ts#L315-L338) |
| User approve → `approve-action` → resume purchase | [`approvals/routes.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/approvals/routes.ts#L16-L33) · [`tasks/service.ts#resumeApprovedTask`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/tasks/service.ts#L134-L198) |
| Approvals inbox UI | [`frontend/src/components/approvals/ApprovalsView.tsx`](https://github.com/SamFelix03/T3Pay/blob/main/frontend/src/components/approvals/ApprovalsView.tsx) |

### 9. Receipts & verification

| Step | Code |
|---|---|
| Issue via T3N `issue-receipt` contract | [`backend/src/modules/receipts/service.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/receipts/service.ts#L58-L106) |
| Deterministic hash verify (demo; not SD-JWT on current testnet) | [`receipts/service.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/receipts/service.ts#L109-L119) |
| Receipts UI + detail modal | [`frontend/src/components/receipts/ReceiptsView.tsx`](https://github.com/SamFelix03/T3Pay/blob/main/frontend/src/components/receipts/ReceiptsView.tsx) |

### 10. Dashboard & activity

| Concern | Code |
|---|---|
| Aggregated totals | [`backend/src/modules/dashboard/routes.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/dashboard/routes.ts) |
| Audit log writes | [`backend/src/modules/activity/service.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/activity/service.ts) |
| Dashboard UI | [`frontend/src/components/dashboard/DashboardView.tsx`](https://github.com/SamFelix03/T3Pay/blob/main/frontend/src/components/dashboard/DashboardView.tsx) |

### 11. Chat purchase outcomes

| Outcome | UI |
|---|---|
| `approved` | Green success card — [`AgentChatMessage.tsx`](https://github.com/SamFelix03/T3Pay/blob/main/frontend/src/components/agents/chat/AgentChatMessage.tsx) |
| `rejected` / `revoked` | Red blocked card — [`purchase-outcome.ts`](https://github.com/SamFelix03/T3Pay/blob/main/frontend/src/lib/purchase-outcome.ts) |
| `pending_approval` | Amber approval card — [`useVaultPayApp.ts#runFromChat`](https://github.com/SamFelix03/T3Pay/blob/main/frontend/src/hooks/useVaultPayApp.ts#L598-L612) |

---

## How Terminal 3 powers T3Pay

T3Pay is load-bearing on real T3N testnet primitives: **tenant contracts**, **KV maps**, **agent-auth delegation**, **authenticated agent invocation**, and **audit/logs**. Supabase is never the source of truth for grants or policy.

### VaultPay WASM contract (`vaultpay-contracts` v0.2.1)

Single consolidated contract (requirements described four logical contracts; implementation merges them into one WASM module).

| Export | Responsibility | Rust implementation |
|---|---|---|
| `create-mandate` | Seal compact mandate + hash | [`vaultpay.rs#L15-L21`](https://github.com/SamFelix03/T3Pay/blob/main/contracts/vaultpay/src/vaultpay.rs#L15-L21) · export [`lib.rs#L30-L35`](https://github.com/SamFelix03/T3Pay/blob/main/contracts/vaultpay/src/lib.rs#L30-L35) |
| `read-mandate` | Fetch mandate from KV | [`vaultpay.rs#L23-L38`](https://github.com/SamFelix03/T3Pay/blob/main/contracts/vaultpay/src/vaultpay.rs#L23-L38) |
| `read-remaining` | Budget remaining query | [`vaultpay.rs#L40-L52`](https://github.com/SamFelix03/T3Pay/blob/main/contracts/vaultpay/src/vaultpay.rs#L40-L52) · export [`lib.rs#L51-L56`](https://github.com/SamFelix03/T3Pay/blob/main/contracts/vaultpay/src/lib.rs#L51-L56) |
| `revoke-mandate` | Mark mandate revoked | [`vaultpay.rs#L54-L62`](https://github.com/SamFelix03/T3Pay/blob/main/contracts/vaultpay/src/vaultpay.rs#L54-L62) |
| `validate-and-pay` | **Core policy engine** | [`vaultpay.rs#L64-L71`](https://github.com/SamFelix03/T3Pay/blob/main/contracts/vaultpay/src/vaultpay.rs#L64-L71) · [`evaluate_policy`](https://github.com/SamFelix03/T3Pay/blob/main/contracts/vaultpay/src/vaultpay.rs#L110-L163) |
| `create-approval-request` | Pending approval record | [`vaultpay.rs#L73-L79`](https://github.com/SamFelix03/T3Pay/blob/main/contracts/vaultpay/src/vaultpay.rs#L73-L79) |
| `approve-action` | Mark approval approved | [`vaultpay.rs#L81-L83`](https://github.com/SamFelix03/T3Pay/blob/main/contracts/vaultpay/src/vaultpay.rs#L81-L83) |
| `reject-action` | Mark approval rejected | [`vaultpay.rs#L85-L87`](https://github.com/SamFelix03/T3Pay/blob/main/contracts/vaultpay/src/vaultpay.rs#L85-L87) |
| `issue-receipt` | Receipt + content hash | [`vaultpay.rs#L89-L95`](https://github.com/SamFelix03/T3Pay/blob/main/contracts/vaultpay/src/vaultpay.rs#L89-L95) |
| `verify-receipt` | Hash integrity check | [`vaultpay.rs#L97-L108`](https://github.com/SamFelix03/T3Pay/blob/main/contracts/vaultpay/src/vaultpay.rs#L97-L108) |

**Policy checks inside `evaluate_policy`:** revoked · expired · agent mismatch · merchant allowlist · category allowlist · payment method · budget · per-purchase limit · approval threshold — [`vaultpay.rs#L125-L154`](https://github.com/SamFelix03/T3Pay/blob/main/contracts/vaultpay/src/vaultpay.rs#L125-L154).

**WIT host imports declared** (payment boundary architecture): `kv-store`, `http`, `http-with-placeholders`, `logging`, `tenant-context` — [`world.wit`](https://github.com/SamFelix03/T3Pay/blob/main/contracts/vaultpay/wit/world.wit). Settlement against the mock merchant runs in the Node backend today; credential injection is modeled at the T3N boundary per requirements.

**Compact record limit:** 511 bytes — [`constants.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/config/constants.ts#L8) · enforced [`vaultpay.rs`](https://github.com/SamFelix03/T3Pay/blob/main/contracts/vaultpay/src/vaultpay.rs) via `MAX_CONTRACT_RECORD_BYTES`.

### Backend T3N gateway

All SDK calls funnel through [`backend/src/modules/t3n/gateway.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts).

| Gateway method | T3N / contract action |
|---|---|
| `createMandate` | `create-mandate` + KV write — [L78-L83](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L78-L83) |
| `readMandate` | `read-mandate` — [L91-L93](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L91-L93) |
| `revokeMandate` | `revoke-mandate` — [L85-L89](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L85-L89) |
| `validateAndPay` | User-tenant `validate-and-pay` — [L95-L119](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L95-L119) |
| `validateAndPayAsAgent` | Agent-auth path + `executeBusinessContract` — [L146-L243](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L146-L243) |
| `createAgentIdentity` | Separate agent DID via derived key — [L245-L260](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L245-L260) |
| `authenticateAgent` | Agent handshake + `createEthAuthInput` — [L121-L144](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L121-L144) |
| `createAgentGrant` | Full ADK delegation pipeline — [L263-L392](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L263-L392) |
| `revokeAgentGrant` | `revokeDelegation` — [L394-L407](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L394-L407) |
| `getAgentProof` | `getAuditEvents` + `contracts.logs` — [L409-L426](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L409-L426) |
| `createApproval` / `approveAction` / `rejectAction` | Approval contract fns — [L428-L445](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L428-L445) |
| `issueReceipt` / `verifyReceipt` | Receipt contract fns — [L447-L456](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L447-L456) |
| `writeMapValue` | `executeControl("map-entry-set")` — [L458-L467](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L458-L467) |

### `@terminal3/t3n-sdk` — every surface used in this repo

| SDK export / API | Role in T3Pay | Primary reference |
|---|---|---|
| `setEnvironment` | Target testnet/production | [`gateway.ts#L541-L547`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L541-L547) · [`scripts/lib/t3n-client.mjs`](https://github.com/SamFelix03/T3Pay/blob/main/scripts/lib/t3n-client.mjs#L15) |
| `setNodeUrl` | Optional custom node | [`gateway.ts#L546`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L546) |
| `getNodeUrl` | Resolve T3N base URL | [`gateway.ts#L501`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L501) |
| `loadWasmComponent` | WASM loader for `T3nClient` | [`gateway.ts#L524`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L524) |
| `T3nClient` | Core client (handshake, auth, execute) | [`gateway.ts#L522-L528`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L522-L528) |
| `TenantClient` | Tenant contracts, controls, delegated exec | [`gateway.ts#L508-L514`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L508-L514) |
| `createEthAuthInput` | ETH-based DID authentication | [`gateway.ts#L133`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L133) |
| `eth_get_address` | Derive address from private key | [`gateway.ts#L130`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L130) |
| `metamask_sign` | `EthSign` handler for headless signing | [`gateway.ts#L526`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L526) |
| `t3n.handshake()` | Session establishment | [`gateway.ts#L132`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L132) |
| `t3n.authenticate()` | Bind session to DID | [`gateway.ts#L133`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L133) |
| `tenant.contracts.register` | Publish WASM to tenant | [`scripts/register-contracts.mjs#L17`](https://github.com/SamFelix03/T3Pay/blob/main/scripts/register-contracts.mjs#L17) |
| `tenant.contracts.execute` | Invoke contract functions | [`gateway.ts#L472-L476`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L472-L476) |
| `tenant.contracts.logs` | Contract execution logs | [`gateway.ts#L420`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L420) |
| `tenant.executeControl("map-entry-set")` | KV map writes | [`gateway.ts#L461-L465`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L461-L465) |
| `tenant.canonicalName` | Map / contract name resolution | [`gateway.ts#L462`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L462) |
| `tenant.executeBusinessContract` | Agent-delegated `validate-and-pay` | [`gateway.ts#L200-L207`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L200-L207) |
| `buildDelegationCredential` | ADK delegation VC payload | [`gateway.ts#L319-L334`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L319-L334) |
| `canonicaliseCredential` | JCS canonical form | [`gateway.ts#L335`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L335) |
| `signCredential` | User signature on delegation | [`gateway.ts#L337`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L337) |
| `buildInvocationPreimage` | Agent invocation binding | [`gateway.ts#L349`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L349) |
| `signAgentInvocation` | Agent co-signature | [`gateway.ts#L350`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L350) |
| `b64uEncodeBytes` | Base64url encoding for stored grant material | [`gateway.ts#L378-L384`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L378-L384) |
| `getScriptVersion` | Resolve `tee:user/contracts` + VaultPay versions | [`gateway.ts#L309`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L309) |
| `t3n.executeAndDecode` | `agent-auth-update` grant registration | [`gateway.ts#L353-L372`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L353-L372) |
| `revokeDelegation` | Revoke ADK grant on-chain | [`gateway.ts#L400-L405`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L400-L405) |
| `t3n.getAuditEvents` | T3N audit trail for agent proof | [`gateway.ts#L412`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L412) |

**SDK surfaces from requirements *not* wired in this build** (documented explicitly):

| Surface | Status | Note |
|---|---|---|
| `DelegationCustodialClient` | Not used | Manual credential + `agent-auth-update` path instead — [`gateway.ts#createAgentGrant`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L263-L392) |
| `sign-sd-jwt-vc` | Not on testnet | Deterministic receipt hash fallback — [`t3n/service.ts#L26`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/service.ts#L26) |
| `outbox` | Not on testnet | App toasts + polling — [`useVaultPayApp.ts`](https://github.com/SamFelix03/T3Pay/blob/main/frontend/src/hooks/useVaultPayApp.ts) |
| `fraud-signal-contract` / cross-tenant demo | Not implemented | Optional per requirements §TEE Contracts |

### ADK grant shape

Scoped grant binds: **agent DID** → **contract tail** → **`validate-and-pay`** → **allowed hosts** → **mandate hash metadata** — [`constants.ts`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/config/constants.ts#L10-L14) · [`gateway.ts#L319-L346`](https://github.com/SamFelix03/T3Pay/blob/main/backend/src/modules/t3n/gateway.ts#L319-L346).

### Operator scripts (T3N CLI)

| Script | Purpose |
|---|---|
| [`scripts/t3n-auth-check.mjs`](https://github.com/SamFelix03/T3Pay/blob/main/scripts/t3n-auth-check.mjs) | Auth smoke test |
| [`scripts/create-mandate-probe.mjs`](https://github.com/SamFelix03/T3Pay/blob/main/scripts/create-mandate-probe.mjs) | Mandate contract probe |
| [`scripts/grant-agent.mjs`](https://github.com/SamFelix03/T3Pay/blob/main/scripts/grant-agent.mjs) | Standalone `agent-auth-update` |
| [`scripts/contract-logs.mjs`](https://github.com/SamFelix03/T3Pay/blob/main/scripts/contract-logs.mjs) | Tail contract logs |
| [`scripts/e2e-api.mjs`](https://github.com/SamFelix03/T3Pay/blob/main/scripts/e2e-api.mjs) | Full regression including revocation block |

---

## Conclusion

T3Pay is a **platform where anyone can create personal agents and let them spend safely** — not just a payment demo. It is the **missing personal trust layer for agentic commerce**.

- **You** create agents, set budgets, chat to buy, and revoke access instantly.
- **Your agents** get enough delegated authority to be useful — without credentials.
- **Merchants** get a verifiable agent identity and auditable receipt.
- **Terminal 3** features are load-bearing:

| T3N capability | Role |
|---|---|
| **KV maps** | Mandates, secrets refs, approvals, receipts |
| **Secrets** | Payment credentials sealed from agent memory |
| **agent-auth** | Binds a specific agent DID to specific contract functions & hosts |
| **http-with-placeholders** | Architecture for credential injection at merchant boundary (WIT import) |
| **Tenant contracts** | Policy, receipts, approvals in WASM |
| **executeBusinessContract** | Agent-authenticated delegated purchases |
| **Audit + contract logs** | Tamper-evident action proof |
| **sign-sd-jwt-vc** | Verifiable receipts when testnet supports it; demo hash today |
| **outbox** | Push notifications when available; in-app polling today |

This is a **create-your-agent, set-your-rules, let-it-shop** platform — demo-able end to end on **T3N testnet** with real contracts, storage, and delegation, and a local mock merchant only where no official Terminal 3 test merchant exists.
