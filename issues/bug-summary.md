# T3Pay — Terminal 3 / ADK Bug & Documentation Gap Summary

**Purpose:** Document the most commonly encountered Terminal 3 (T3N / ADK) bugs and documentation gaps that affected building T3Pay, with T3Pay-specific impact and workarounds.

**Audience:** Terminal 3 engineers, demo operators, and anyone filing or triaging Terminal 3 feedback.

**Severity legend:** **blocker** · **major** · **medium** · **minor**

---

## Executive summary — what hurt T3Pay most

Building T3Pay required a **real** T3N path: register a tenant WASM contract, seal mandates in KV, mint ADK grants in code, authenticate a **separate agent DID**, invoke `validate-and-pay` through delegation, and prove outcomes via audit/logs. The product shipped, but only after working around several platform and documentation failures that are **not** obvious from the getting-started walkthrough.

| Priority | Theme | T3Pay impact |
|:---:|---|---|
| 1 | **KV `map-entry-set` fails at ≥512 bytes (HTTP 500)** | Blocked full-size mandate persistence until compact-record / chunking workarounds |
| 2 | **`TenantClient` control plane requires explicit `baseUrl`** | Blocked early registration until we found `getNodeUrl()` (official walkthrough now documents this; SDK README still does not) |
| 3 | **ADK credential delegation API undocumented** | Full `buildDelegationCredential` → signed grant path built from `index.d.ts`; only low-level `agent-auth-update` appears in invoke walkthrough |
| 4 | **`buildDelegationCredential` / `MAX_CONTRACT_LEN` vs tenant script names** | Risk when binding grants to canonical `z:<tid>:<tail>` names |
| 5 | **Stale / contradictory onboarding snippets** | Wrong placeholder HTTP shape, env var names, default **production** node, `Did` object vs string |
| 6 | **Official sample README teaches pre-privacy model** | Easy to mis-design agent payloads if following `z-tenant-flight` prose over source |
| 7 | **`revokeDelegation()` default path broken without `baseUrl`** | Agent revocation had to pass explicit node URL |
| 8 | **Audit API exists but is undiscoverable** | `getAuditEvents` used in run traces with no developer page — see [`getAgentProof`](../backend/src/modules/t3n/gateway.ts#L409-L426) |

---

## 1. Platform / runtime issues (T3N testnet)

### KV-001 — `map-entry-set` and contract `kv-store::put` return HTTP 500 for values ≥512 bytes

| | |
|---|---|
| **Severity** | **blocker** (for single-entry mandate storage) |
| **Status** | Workaround validated on testnet; upstream open |

**What happens:** Authenticated tenant control writes succeed up to **511 bytes**; **512+ bytes** return `HTTP 500 internal_error` with no typed quota message. The same failure appeared for contract-side `kv_store::put` inside WASM. Early VaultPay mandate JSON exceeded this ceiling; the current contract enforces `MAX_CONTRACT_RECORD_BYTES = 511` ([`model.rs`](../contracts/vaultpay/src/model.rs#L3)).

**How it blocked T3Pay:**

- `create-mandate` could run on T3N and return a valid mandate + hash.
- Persisting an oversized mandate to `z:<tid>:mandates` failed, so `validate-and-pay` could not read policy state from real KV.
- Per [`docs/requirements.md`](../docs/requirements.md), we could **not** fall back to local mandate storage or a simulator and still claim a real T3N demo.

**T3Pay workaround (current):** Compact mandate/approval/receipt records kept under the 511-byte ceiling in contract `0.2.1` ([`references.md`](../docs/references.md#L383-L385)). An earlier chunking layout (`<id>.__chunk.N` + count entry) was also validated on testnet for larger payloads. [`writeMapValue`](../backend/src/modules/t3n/gateway.ts#L458-L467) still does single-entry writes — anything above 511 bytes will fail until upstream raises the limit or chunking is wired into the gateway.

**Doc gap (verified):** [Common errors](https://docs.terminal3.io/developers/adk/tips/common-errors) documents generic `quota exceeded` but **not** the 512-byte per-entry KV ceiling.

---

## 2. SDK runtime bugs

### SDK-001 — `TenantClient` control operations require `baseUrl` despite `setEnvironment()`

| | |
|---|---|
| **Severity** | **major** |
| **Verified** | **Confirmed** (SDK); **partially fixed** in official ADK walkthrough (2026-06-20) |

**What happens:** `tenant.contracts.register()` and other control calls throw `TenantClient config requires baseUrl for tenant control operations` unless `baseUrl: getNodeUrl()` is passed. On a fresh process the SDK defaults to **production** (`getEnvironment() === "production"`, `getNodeUrl()` → `https://cn-api.sg.prod.t3n.terminal3.io`) until `setEnvironment("testnet")` is called.

**Doc status (verified against [references.md](../docs/references.md) links):**

- [Set up dev env](https://docs.terminal3.io/developers/adk/get-started/prerequisites/set-up-dev-env) **now** shows `new TenantClient({ t3n, baseUrl: getNodeUrl(), tenantDid })` and `setEnvironment("testnet")`.
- [Register contract](https://docs.terminal3.io/developers/adk/get-started/walkthrough/register-contract) points builders to that setup page before calling `tenant.contracts.register`.
- The shipped **SDK README** still omits `TenantClient`, uses `T3N_DEMO_KEY`, and its Ethereum example omits both `setEnvironment("testnet")` and `baseUrl` — copying it silently targets production.

**T3Pay impact:** First contract registration on testnet failed until [`gateway.ts`](../backend/src/modules/t3n/gateway.ts#L486-L514) and [`scripts/register-contracts.mjs`](../scripts/register-contracts.mjs) always passed `baseUrl` + `endpoint`. Same pattern required for [`map-entry-set`](../backend/src/modules/t3n/gateway.ts#L458-L467).

**Workaround:** Always call `setEnvironment("testnet")` first; construct `TenantClient` with `{ baseUrl: getNodeUrl(), t3n, tenantDid }`. Do not rely on the SDK README alone.

---

### SDK-002 — `revokeDelegation()` builds a relative URL when `baseUrl` is omitted

| | |
|---|---|
| **Severity** | **major** |
| **Verified** | **Confirmed** on installed `@terminal3/t3n-sdk` (repro: `Failed to parse URL from /api/contracts/current?name=tee%3Adelegation%2Fcontracts`) |

**What happens:** Default `revokeDelegation({ credentialJcsB64u, client })` calls `getScriptVersion("", "tee:delegation/contracts")` → `fetch("/api/contracts/current?...")` → unparseable relative URL in Node.

**T3Pay impact:** Agent revocation in [`revokeAgentGrant`](../backend/src/modules/t3n/gateway.ts#L394-L407) must pass `baseUrl` from [`getClients()`](../backend/src/modules/t3n/gateway.ts#L481-L483). Revoke is a core demo scene (Scene 10 in requirements).

---

### SDK-003 — `buildDelegationCredential()` rejects canonical tenant contract names (`ContractTooLong`)

| | |
|---|---|
| **Severity** | **major** |
| **Verified** | **Confirmed** — `canonicalTenantName(tid, "vaultpay-contracts")` (61 chars) throws `ContractTooLong`; tail-only `"vaultpay-contracts"` succeeds |

**What happens:** `canonicalTenantName(did, tail)` produces `z:<40-hex>:<tail>` (length `43 + tail.length`), but credential validation rejects contracts longer than 46 characters. Any tail ≥4 characters cannot use the full canonical script name. SDK TSDoc describes the field only as `Contract id, e.g. "tee:payroll"` — no guidance for tenant `z:<tid>:<tail>` contracts.

**T3Pay impact:** Grant creation in [`createAgentGrant`](../backend/src/modules/t3n/gateway.ts#L308) uses `credentialContract = this.env.vaultpayContractTail` (e.g. `vaultpay-contracts`) rather than the full canonical script name — a convention we had to infer. Wrong value would break ADK grant ↔ invocation alignment.

---

### SDK-004 — `b64uDecodeStrict()` accepts non-canonical base64url

| | |
|---|---|
| **Severity** | **minor** |

**T3Pay impact:** Low direct impact today; relevant because we store grant material as base64url fields (`credential_jcs_b64u`, `vc_id`, etc.) in Supabase projections. Malleable decoding could confuse credential round-trips if inputs are ever user-supplied.

---

### SDK-005 — `toBaseUnits()` uses float math (precision loss)

| | |
|---|---|
| **Severity** | **minor** |

**T3Pay impact:** Dashboard credit display uses SDK usage types; large balances risk silent precision loss. We scope demo amounts to stay within safe integers.

---

### SDK-006 — `buildDelegationCredential()` rejects unsorted `functions` with no normalizer

| | |
|---|---|
| **Severity** | **medium** |
| **Verified** | **Confirmed** — unsorted `functions` throws `UnsortedFunctions`; requirement is in SDK TSDoc but absent from [llms.txt](https://docs.terminal3.io/llms.txt) developer pages |

**What happens:** `buildDelegationCredential` requires `functions` to be lexicographically sorted and deduped. The SDK exports no normalizer helper. The invariant is documented in `BuildDelegationCredentialOpts` TSDoc but not in the ADK walkthrough or data-owner guides.

**T3Pay impact:** Grant creation failed during early integration when we passed role-derived function lists in UI order. [`createAgentGrant`](../backend/src/modules/t3n/gateway.ts#L305-L306) now explicitly sorts both `functions` and `allowedHosts` before calling `buildDelegationCredential`. Any new grant path (scripts, tests, future roles) must remember this or grants fail opaquely.

**Workaround:** Always `.sort()` function and host lists before `buildDelegationCredential`; treat unsorted input as a programmer error.

---

## 3. Documentation gaps

### DOC-001 — ADK credential delegation lifecycle is undocumented in developer docs

| | |
|---|---|
| **Severity** | **major** |
| **Verified** | **Partially confirmed** — see nuance below |

**Gap (verified):**

- [Delegate Access](https://docs.terminal3.io/t3n/data-owner-guide/delegate-access) and [Delegate Access to AI Agents](https://docs.terminal3.io/t3n/use-cases/delegate-access-to-agent) describe **Dashboard-only** grants (AI Agents tab → New agent → Remove). No SDK functions are named.
- [Invoke contract](https://docs.terminal3.io/developers/adk/get-started/walkthrough/invoke-contract) **does** document programmatic `agent-auth-update` via `userClient.execute({ script_name: "tee:user/contracts", function_name: "agent-auth-update", ... })` — but not the ADK credential helpers (`buildDelegationCredential`, `signCredential`, `signAgentInvocation`, `revokeDelegation`).
- Full-text search of [llms-full.txt](https://docs.terminal3.io/llms-full.txt) (117 KB, fetched 2026-06-20): **zero hits** for `getAuditEvents`, `buildDelegationCredential`, `signAgentInvocation`, or `revokeDelegation`.
- [Payroll Agent](https://docs.terminal3.io/developers/adk/use-cases/payroll-agent) is a one-line stub redirecting elsewhere.
- [Host API](https://docs.terminal3.io/t3n/how-t3n-works/host-api) lists `signing`, `outbox`, and `agent-auth` host interfaces as **Coming soon**; `sign-sd-jwt-vc` / `outbox` are not available for VaultPay receipts today.

**T3Pay impact:** The high-level grant T3Pay ships ([`createAgentGrant`](../backend/src/modules/t3n/gateway.ts#L263-L392)) was reverse-engineered from SDK types and [`scripts/grant-agent.mjs`](../scripts/grant-agent.mjs). Mandate + grant from the UI ([`mandates/routes.ts`](../backend/src/modules/mandates/routes.ts#L48-L60)) has no official end-to-end walkthrough for the credential-signing path.

---

### DOC-002 — `getAuditEvents` / contract logs are undocumented

| | |
|---|---|
| **Severity** | **major** |
| **Verified** | **Confirmed** — not listed in [llms.txt](https://docs.terminal3.io/llms.txt); absent from [llms-full.txt](https://docs.terminal3.io/llms-full.txt) full-text search |

**Gap:** `T3nClient.getAuditEvents` and `tenant.contracts.logs` exist in the SDK but have no developer page. The `committed` flag on audit batches (durable vs in-flight) is only described in TSDoc.

**T3Pay impact:** Run trace panel and agent audit endpoint ([`agents/routes.ts`](../backend/src/modules/agents/routes.ts#L76-L79)) depend on [`getAgentProof`](../backend/src/modules/t3n/gateway.ts#L409-L426) for “proof” sections. Builders must discover these from `.d.ts` alone.

---

### DOC-003 — Invoke / execute payload shape disagrees across docs and types

| | |
|---|---|
| **Severity** | **major** |
| **Verified** | **Confirmed** on [invoke-contract](https://docs.terminal3.io/developers/adk/get-started/walkthrough/invoke-contract) vs SDK `ContractExecuteInput` |

**Gap:** The invoke walkthrough uses `executeAndDecode({ script_name, script_version, function_name, input })` (snake_case, includes `script_name`). `TenantClient.contracts.execute` types use `{ version, functionName, input? }` (camelCase, no `script_name`). Both shapes may work at runtime via `executeAndDecode`, but the docs do not explain which entry point accepts which shape.

**T3Pay impact:** We standardized on [`executeAsUser`](../backend/src/modules/t3n/gateway.ts#L469-L477) (`tenant.contracts.execute` with camelCase `functionName` / `version`). Payroll-specific bigint wire issues did not block VaultPay but illustrate the same class of doc/type/runtime drift.

---

### DOC-004 — `authenticate()` returns a `Did` object, not a string

| | |
|---|---|
| **Severity** | **medium** |
| **Verified** | **Partially confirmed** — official walkthrough fixed; SDK README still wrong |

**Gap:** SDK type is `interface Did { readonly value: string }`. [Set up dev env](https://docs.terminal3.io/developers/adk/get-started/prerequisites/set-up-dev-env) correctly shows `const tenantDid = did.value`. The **SDK README** still assigns `const did = await client.authenticate(...)` with no `.value`, implying a plain string.

**T3Pay impact:** [`gateway.ts`](../backend/src/modules/t3n/gateway.ts#L133) correctly uses `.value` after `authenticate()`. Easy footgun when copying SDK README examples into new scripts.

---

### DOC-005 — `http-with-placeholders` snippet errors and secrets ref provisioning gap

| | |
|---|---|
| **Severity** | **major** |
| **Verified** | **Confirmed** — [placeholders-outbound-calls](https://docs.terminal3.io/developers/adk/tips/placeholders-outbound-calls) vs WIT bindings |

**What the docs get right (verified):** The placeholders page explains the `{{profile.*}}` model, synchronous behavior, egress gating, and delegation requirements. This matches how T3Pay reasons about profile-bound PII.

**What is still wrong or missing (verified):**

| Issue | Evidence |
|---|---|
| Rust snippet uses `body` | Official snippet: `body: Some(serde_json::to_vec(&body)?)` |
| WIT uses `payload` | [`package.wit`](../contracts/vaultpay/wit/deps/host-interfaces-2.1.0/package.wit#L72-L77): `record request { method: verb, …, payload: option<list<u8>> }` |
| Snippet uses string HTTP method | Snippet: `method: "POST".to_string()` |
| WIT uses `verb` enum | WIT: `enum verb { get, post, put, patch, delete }` |
| No secrets / payment ref provisioning | [references.md](../docs/references.md#L220-L222) open issue: docs emphasize `{{profile.*}}` but do not document arbitrary `secrets` map substitution for payment credentials |

**T3Pay impact:** WIT imports `http-with-placeholders`, but settlement uses a **local mock merchant** ([`merchant/service.ts`](../backend/src/modules/merchant/service.ts)). Copy-pasting the official Rust snippet into a contract would not compile against current bindings without manual correction.

---

### DOC-006 — Official sample (`z-tenant-flight`) README contradicts source and newer docs

| | |
|---|---|
| **Severity** | **major** |
| **Verified** | **Confirmed** — [GitHub README](https://github.com/Terminal-3/z-tenant-flight) fetched 2026-06-20 |

| Issue | Summary | Verified |
|---|---|---|
| Inline PII model | README: `book-offer` posts "with full passenger PII" and "PII is passed in by the agent" | **Yes** — contradicts [invoke-contract](https://docs.terminal3.io/developers/adk/get-started/walkthrough/invoke-contract) and [placeholders-outbound-calls](https://docs.terminal3.io/developers/adk/tips/placeholders-outbound-calls) |
| Obsolete manifest | README still documents `host_capabilities` JSON manifest | **Yes** — [capabilities-from-wit-import](https://docs.terminal3.io/developers/adk/tips/capabilities-from-wit-import) says "there isn't one" |
| Version drift | README says v0.3.0; walkthrough references `travel-contracts` tail | **Yes** — naming/version mismatch across sample and docs |
| Incomplete examples | `book-offer` output shape in README vs walkthrough | **Partial** — walkthrough shows correct no-PII input shape; sample README does not |

**T3Pay impact:** Mental model risk during contract design — VaultPay mandates explicitly keep payment secrets out of agent context ([`docs/requirements.md`](../docs/requirements.md)). The sample README pushes the opposite pattern for booking PII.

---

### DOC-007 — Onboarding surface inconsistencies

| | |
|---|---|
| **Severity** | **minor** – **medium** |
| **Verified** | Mixed — see per-row status |

| Gap | Verified | T3Pay impact |
|---|---|---|
| Setup page says “4 steps”, renders 5 | **Confirmed** — [set-up-dev-env](https://docs.terminal3.io/developers/adk/get-started/prerequisites/set-up-dev-env) subtitle vs five `<Step>` blocks | Trust erosion on first read |
| `T3N_DEMO_KEY` in SDK README vs `T3N_API_KEY` in docs | **Confirmed** — SDK README L41 vs official setup page | We standardized on `T3N_API_KEY` in [`env.ts`](../backend/src/config/env.ts#L28) |
| SDK Quick Start uses fake `baseUrl` | **Confirmed** — SDK README: `baseUrl: "https://t3n-node.example.com"` | Misleading if copied instead of official setup |
| SDK Ethereum example omits `setEnvironment` / targets production | **Confirmed** — fresh SDK defaults to production node | Failed handshakes until we called `setEnvironment("testnet")` |
| Official setup omits `baseUrl` on `T3nClient` intentionally | **Confirmed fixed** — setup uses `setEnvironment("testnet")` and documents `TenantClient` `baseUrl` separately | Reduces but does not eliminate SDK-001 footgun |
| Next.js needs `serverExternalPackages` | **T3Pay-only** — not in Terminal 3 docs | Dev server worker errors until externalized |
| `adk-getting-start` repo empty | **Confirmed** — GitHub API: "This repository is empty." | No official E2E template; we authored [`scripts/e2e-api.mjs`](../scripts/e2e-api.mjs) |
| `becomeDevTenant` buried in field TSDoc | **Confirmed** — in SDK `SubmitUserInputArgs` TSDoc only; not in llms.txt pages | Testnet credits path non-obvious |
| Pre-sorted `functions` for delegation | **Confirmed** — SDK TSDoc only (see SDK-006) | [`createAgentGrant`](../backend/src/modules/t3n/gateway.ts#L305) sorts explicitly |
| Two different “OTP” flows share naming | **Confirmed** in SDK types | N/A for VaultPay (Supabase email auth) |

---

### DOC-008 — Host API capability matrix contradicts SDK and invoke walkthrough

| | |
|---|---|
| **Severity** | **medium** |
| **Verified** | **Confirmed** — [Host API](https://docs.terminal3.io/t3n/how-t3n-works/host-api) table fetched 2026-06-20 |

**Gap:** The Host API table marks `signing`, `outbox`, `vp`, `did-registry`, `agent-auth`, and `user-profile` as **Coming soon** in the Gating column. Meanwhile:

- The SDK exports `buildDelegationCredential`, `signCredential`, `signAgentInvocation`, `revokeDelegation`, and signing helpers.
- [Invoke contract](https://docs.terminal3.io/developers/adk/get-started/walkthrough/invoke-contract) documents live `agent-auth-update` grants.
- `signing` row describes `sign-sd-jwt-vc` in prose but still says Coming soon — matching T3Pay's decision to use deterministic receipt hashes instead.

There is no versioned matrix reconciling host-interface status vs SDK client exports vs walkthrough examples.

**T3Pay impact:** We spent time assuming agent delegation might not be production-ready because the docs implied it was future work, while the SDK types and exports clearly supported programmatic grants. That mismatch pushed us toward Dashboard-only mental models first, then a slower reverse-engineering pass through `index.d.ts` and operator scripts. The same stale labels also obscure audit (`getAuditEvents`) and signing surfaces that T3Pay depends on for proofs and agent invocation.

**Workaround:** Treat the shipped SDK exports and live testnet behavior as the source of truth; ignore "coming soon" labels unless confirmed against the installed package version.

---

## 4. How these issues shaped T3Pay architecture

The following choices were **direct responses** to the bugs above — not original product design:

| T3Pay decision | Driven by |
|---|---|
| Always pass `baseUrl: getNodeUrl()` on `TenantClient` | SDK-001, SDK-002 |
| Mandate records kept under 511-byte KV ceiling (contract `0.2.1`) | KV-001 |
| Grant `contract` field uses tail (`vaultpay-contracts`), not full `z:<tid>:…` name | SDK-003, DOC-005 |
| Manual ADK grant pipeline in code (no Dashboard step) | DOC-001 |
| `agent-auth-update` via `executeAndDecode` + separate agent DID derivation | DOC-001; [`deriveAgentSecret`](../backend/src/modules/t3n/gateway.ts#L531-L537) |
| Explicit `.sort()` on grant `functions` and `allowedHosts` | SDK-006 |
| `executeBusinessContract` for agent `validate-and-pay` with user-tenant fallback | Delegation path discovery; [`validateAndPayAsAgent`](../backend/src/modules/t3n/gateway.ts#L146-L223) |
| Deterministic receipt hash instead of SD-JWT VC | DOC-001; [`t3n/service.ts`](../backend/src/modules/t3n/service.ts#L26) lists unsupported features |
| Mock merchant in Node, real T3N for policy | DOC-005; requirements merchant boundary |
| Extensive operator scripts under [`scripts/`](../scripts/) | DOC-007, SDK-001, KV-001 |

---

## 5. Recommended filing priority (for upstream Terminal 3)

If submitting a minimal upstream bundle from T3Pay’s experience:

1. **KV-001** — Return HTTP 400 with quota detail at 512 bytes, or raise limit; document max value size.
2. **SDK-001** — Default SDK examples to testnet; align SDK README with official setup (`T3N_API_KEY`, `TenantClient`, `did.value`). Official walkthrough partially fixed — SDK README still needs update.
3. **SDK-003** — Align `MAX_CONTRACT_LEN` with `canonicalTenantName`, or document delegation `contract` field format for tenant WASM.
4. **DOC-001** — Publish programmatic ADK delegation guide (`buildDelegationCredential` → signed grant → `agent-auth-update`) linked from data-owner docs; cross-link from invoke walkthrough.
5. **DOC-005, DOC-006** — Fix sample README PII model and placeholder quick-tip to match generated bindings.
6. **SDK-002** — Default `revokeDelegation` `baseUrl` from authenticated client.
7. **DOC-002** — Document `getAuditEvents` + `contracts.logs` + `committed` semantics.
8. **DOC-007** — Unify env var naming; default SDK examples to testnet; never silent production default.
9. **SDK-006** — Export a `normalizeDelegationFunctions()` helper or accept unsorted input with a clear error message.
10. **DOC-008** — Publish a versioned capability-status matrix aligned with the shipped SDK.

---

## 6. What is *not* claimed here

To stay accurate about what we verified vs what we assumed:

- **Handshake does not require `MlKemPublicKey` / `Random` handlers** in current SDK — verified live; not a blocker.
- **One-time WASM path `URL` instance error** — not reproducible; not submitted upstream.
- **`DelegationCustodialClient`** — listed in requirements but **not used** in T3Pay; we use manual credential + `signAgentInvocation` instead ([`gateway.ts`](../backend/src/modules/t3n/gateway.ts)).
- **`sign-sd-jwt-vc` / `outbox`** — not available on active testnet; demo uses receipt hashes + app toasts ([`t3n/service.ts`](../backend/src/modules/t3n/service.ts)).
- **Built-in `tee:payroll` org provisioning** — payroll SDK path blocked for greenfield tenants; VaultPay uses a **custom `z:<tid>:vaultpay-contracts`** contract instead.

---

## 7. Related T3Pay files

| Area | Path |
|---|---|
| T3N gateway (all SDK calls) | [`backend/src/modules/t3n/gateway.ts`](../backend/src/modules/t3n/gateway.ts) |
| WASM contract / policy | [`contracts/vaultpay/src/vaultpay.rs`](../contracts/vaultpay/src/vaultpay.rs) |
| Mandate + grant API | [`backend/src/modules/mandates/routes.ts`](../backend/src/modules/mandates/routes.ts) |
| Agent revoke | [`backend/src/modules/agents/routes.ts`](../backend/src/modules/agents/routes.ts) |
| Operator scripts | [`scripts/`](../scripts/) |
| KV persistence issue (detailed) | [`issues/t3n-kv-map-entry-set-and-contract-kv-put-500.md`](./t3n-kv-map-entry-set-and-contract-kv-put-500.md) |
| Product requirements | [`docs/requirements.md`](../docs/requirements.md) |

---

## 8. Documentation verification audit (2026-06-20)

Every Terminal 3 documentation URL listed in [`docs/references.md`](../docs/references.md) was fetched or searched. Product/marketing pages were checked for context only. SDK behavior was re-verified against the installed `@terminal3/t3n-sdk` package in this workspace.

### Docs index and architecture pages

| Reference URL | Checked | Relevant to |
|---|---|---|
| [llms.txt](https://docs.terminal3.io/llms.txt) | Yes | DOC-002, DOC-001 — no audit or delegation SDK pages indexed |
| [llms-full.txt](https://docs.terminal3.io/llms-full.txt) | Yes (117 KB) | DOC-001, DOC-002 — zero hits for `getAuditEvents`, `buildDelegationCredential`, `revokeDelegation` |
| [About T3](https://docs.terminal3.io/intro/about-t3) | Yes | Context only — no gap findings |
| [Platform Overview](https://docs.terminal3.io/intro/platform.md) | Yes | Context only |
| [What is T3N?](https://docs.terminal3.io/t3n/overview/what-is-t3n) | Yes | Context only |
| [Why T3N?](https://docs.terminal3.io/t3n/overview/why-t3n) | Yes | Context only |
| [What is ADK?](https://docs.terminal3.io/developers/adk/overview/what-is-adk) | Yes | Context only |
| [Why T3 ADK?](https://docs.terminal3.io/developers/adk/overview/why-adk) | Yes | Context only |

### ADK setup and walkthrough

| Reference URL | Checked | Finding |
|---|---|---|
| [Request Test Tokens](https://docs.terminal3.io/developers/adk/get-started/prerequisites/request-test-tokens) | Yes | Uses "developer key" wording; links to setup — no `T3N_DEMO_KEY` (supports DOC-007 SDK mismatch) |
| [Set Up Development Environment](https://docs.terminal3.io/developers/adk/get-started/prerequisites/set-up-dev-env) | Yes | **Partial fix:** shows `setEnvironment("testnet")`, `T3N_API_KEY`, `did.value`, `TenantClient` + `baseUrl`. **Still wrong:** subtitle says "4 steps", five steps render (DOC-007) |
| [Write contract](https://docs.terminal3.io/developers/adk/get-started/walkthrough/write-contract) | Yes | No gap corrections needed |
| [Build contract](https://docs.terminal3.io/developers/adk/get-started/walkthrough/build-contract) | Yes | No gap corrections needed |
| [Register contract](https://docs.terminal3.io/developers/adk/get-started/walkthrough/register-contract) | Yes | Points to setup for `TenantClient`; does not repeat construction inline — **SDK-001 partially mitigated** in official docs |
| [Invoke contract](https://docs.terminal3.io/developers/adk/get-started/walkthrough/invoke-contract) | Yes | **DOC-003 confirmed** (snake_case `executeAndDecode`). **DOC-001 partial:** documents `agent-auth-update` but not ADK credential helpers |
| [Dev Community Support](https://docs.terminal3.io/developers/adk/support/t3-builder-tg) | Yes | Context only |

### ADK tips

| Reference URL | Checked | Finding |
|---|---|---|
| [Create Tenant KV Maps](https://docs.terminal3.io/developers/adk/tips/create-kv-maps) | Yes | No per-entry byte limit documented — supports KV-001 doc gap |
| [Seed API key](https://docs.terminal3.io/developers/adk/tips/seed-api-key) | Yes | Documents `map-entry-set` pattern; no size limit |
| [Capabilities from WIT imports](https://docs.terminal3.io/developers/adk/tips/capabilities-from-wit-import) | Yes | Confirms no manifest — supports DOC-006 obsolete `host_capabilities` claim |
| [Outbound HTTP auth by user](https://docs.terminal3.io/developers/adk/tips/outbound-http-auth-by-user) | Yes | Consistent with invoke walkthrough |
| [Placeholders in outbound calls](https://docs.terminal3.io/developers/adk/tips/placeholders-outbound-calls) | Yes | **DOC-005 confirmed** — good profile docs; snippet `body`/string method vs WIT `payload`/`verb` |
| [Common errors](https://docs.terminal3.io/developers/adk/tips/common-errors) | Yes | Generic `quota exceeded` only — **512-byte KV ceiling not documented** (KV-001) |

### T3N architecture and use cases

| Reference URL | Checked | Finding |
|---|---|---|
| [Architecture](https://docs.terminal3.io/t3n/how-t3n-works/architecture) | Yes | Context only |
| [DIDs](https://docs.terminal3.io/t3n/how-t3n-works/did) | Yes | Context only |
| [TEE Node](https://docs.terminal3.io/t3n/how-t3n-works/tees) | Yes | Context only |
| [Host API](https://docs.terminal3.io/t3n/how-t3n-works/host-api) | Yes | **DOC-008 confirmed** — `agent-auth`, `signing`, `outbox`, `vp` marked Coming soon |
| [Storage Namespaces](https://docs.terminal3.io/t3n/how-t3n-works/z-namespace) | Yes | Consistent with T3Pay `z:<tid>:<tail>` usage |
| [Tokens](https://docs.terminal3.io/t3n/how-t3n-works/tokens) | Yes | Context only |
| [Delegate Access to AI Agents](https://docs.terminal3.io/t3n/use-cases/delegate-access-to-agent) | Yes | Product narrative only — no SDK API (DOC-001) |
| [Delegate Access](https://docs.terminal3.io/t3n/data-owner-guide/delegate-access) | Yes | **DOC-001 confirmed** — Dashboard-only workflow |
| [MPC](https://docs.terminal3.io/t3n/use-cases/mpc) | Yes | Context only |
| [Reusable User Data](https://docs.terminal3.io/t3n/use-cases/reusable-user-data) | Yes | Context only |
| [Smart VCs](https://docs.terminal3.io/intro/components/vc) | Yes | Supports receipt fallback decision |
| [Decentralized ID](https://docs.terminal3.io/intro/components/did) | Yes | Context only |
| [Payroll Agent](https://docs.terminal3.io/developers/adk/use-cases/payroll-agent) | Yes | **Stub page** — one-line redirect (DOC-001 / DOC-008) |

### OpenAPI specs (listed in references.md)

| Reference URL | Checked | Finding |
|---|---|---|
| [api-reference/openapi.json](https://docs.terminal3.io/api-reference/openapi.json) | Yes | **HTTP 404** — listed in llms.txt but not served |
| [terminal-3-openapi.yml](https://docs.terminal3.io/terminal-3-openapi.yml) | Yes | **HTTP 404** — listed in llms.txt but not served |

### Sample repositories

| Reference | Checked | Finding |
|---|---|---|
| [Terminal-3/z-tenant-flight](https://github.com/Terminal-3/z-tenant-flight) | Yes | **DOC-006 confirmed** — README still teaches inline PII and obsolete manifest |
| [Terminal-3/adk-getting-start](https://github.com/Terminal-3/adk-getting-start) | Yes | **DOC-007 confirmed** — repository empty |

### SDK package (not a references.md URL; used to verify SDK bugs)

| Check | Result |
|---|---|
| `getEnvironment()` default | `production` |
| `getNodeUrl()` default | `https://cn-api.sg.prod.t3n.terminal3.io` |
| `revokeDelegation` without `baseUrl` | Throws relative URL parse error (**SDK-002**) |
| `buildDelegationCredential` + canonical tenant name (61 chars) | `ContractTooLong` (**SDK-003**) |
| `buildDelegationCredential` + unsorted functions | `UnsortedFunctions` (**SDK-006**) |
| SDK README env var | `T3N_DEMO_KEY` (**DOC-007**) |
| SDK README `authenticate()` | No `.value` shown (**DOC-004**) |

### Finding verdict summary

| ID | Verdict | Notes |
|---|---|---|
| KV-001 | **Confirmed** (platform) | Not documented in common-errors; 511-byte workaround in T3Pay contract |
| SDK-001 | **Confirmed** (SDK) / **partially fixed** (official docs) | Setup page now documents `TenantClient` + `baseUrl` |
| SDK-002 | **Confirmed** | Reproduced on installed SDK |
| SDK-003 | **Confirmed** | Reproduced; TSDoc says `tee:payroll` only |
| SDK-004 | **Not re-run** | Low severity; prior offline repro still cited in SDK |
| SDK-005 | **Not re-run** | Low severity; float precision known from types |
| SDK-006 | **Confirmed** | Reproduced; documented in TSDoc only |
| DOC-001 | **Partially confirmed** | `agent-auth-update` in invoke walkthrough; ADK credential API absent from docs index |
| DOC-002 | **Confirmed** | Absent from llms.txt and llms-full.txt |
| DOC-003 | **Confirmed** | snake_case walkthrough vs camelCase `ContractExecuteInput` |
| DOC-004 | **Partially confirmed** | Fixed in official setup; broken in SDK README |
| DOC-005 | **Confirmed** | Profile docs good; snippet/WIT mismatch; secrets refs undocumented |
| DOC-006 | **Confirmed** | Sample README contradicts newer docs and invoke walkthrough |
| DOC-007 | **Mixed** | Several items confirmed; official setup improved since early integration |
| DOC-008 | **Confirmed** | Host API Coming soon vs SDK exports and invoke walkthrough |

---
