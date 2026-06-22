# T3Pay — Terminal 3 / ADK Bug & Documentation Gap Summary

**Purpose:** Document verified Terminal 3 platform/SDK bugs (with reproduction steps) and obvious documentation gaps encountered while building T3Pay.

**Audience:** Terminal 3 engineers, demo operators, and anyone filing or triaging Terminal 3 feedback.

**Severity legend:** **blocker** · **major**

**Last verified:** 2026-06-22 (SDK bugs reproduced locally against `@terminal3/t3n-sdk@3.9.0`; KV boundary last swept on testnet 2026-06-20).

---

## 1. Verified platform / SDK bugs

Only bugs we can reproduce on the current SDK / testnet. Onboarding footguns and intentional SDK validation rules are omitted.

| ID | Bug | Severity | Repro type |
|:---:|---|:---:|:---:|
| KV-001 | `map-entry-set` fails at ≥512 bytes (HTTP 500) | **blocker** | Live testnet + `scripts/map-smoke.mjs` |
| SDK-001 | `revokeDelegation()` without `baseUrl` throws URL parse error | **major** | Local, no network |
| SDK-002 | `canonicalTenantName()` output rejected by `buildDelegationCredential()` | **major** | Local, no network |

### KV-001 — `map-entry-set` returns HTTP 500 for values ≥512 bytes

| | |
|---|---|
| **Severity** | **blocker** (for single-entry KV persistence) |
| **Status** | Open on T3N testnet; T3Pay works around via compact records ≤511 bytes |

**What happens:** Authenticated `TenantClient.executeControl("map-entry-set", …)` writes succeed up to **511 UTF-8 bytes** and return **HTTP 500** at **512+ bytes**, with no typed quota error. T3Pay still uses single-entry writes in [`writeMapValue`](../backend/src/modules/t3n/gateway.ts#L458-L467); the WASM contract enforces the same ceiling in [`model.rs`](../contracts/vaultpay/src/model.rs#L3).

**Steps to reproduce**

Prerequisites: `.env` with `T3N_API_KEY`, `DID`, `T3N_ENVIRONMENT=testnet`, and maps already created (`node scripts/create-maps.mjs`).

1. Install dependencies:

```sh
npm install
```

2. Write a **511-byte** value (should succeed):

```sh
VAULTPAY_SMOKE_VALUE_KIND=long VAULTPAY_SMOKE_LONG_LEN=511 node scripts/map-smoke.mjs
```

Expected: exit code `0`, JSON output with `valueBytes: 511` and a normal `result`.

3. Write a **512-byte** value (should fail):

```sh
VAULTPAY_SMOKE_VALUE_KIND=long VAULTPAY_SMOKE_LONG_LEN=512 node scripts/map-smoke.mjs
```

Expected: non-zero exit; error message contains `HTTP 500` / `internal_error`.

4. (Optional) Sweep the boundary:

```sh
for n in 500 511 512 513; do
  echo "=== $n bytes ==="
  VAULTPAY_SMOKE_VALUE_KIND=long VAULTPAY_SMOKE_LONG_LEN=$n node scripts/map-smoke.mjs || true
done
```

On 2026-06-20 this produced: 500–511 success, 512+ failure.

**T3Pay impact:** Any mandate, approval, or receipt JSON that exceeds 511 bytes in a single `map-entry-set` call will fail. VaultPay contract `0.2.1` keeps records under that limit. See also [`issues/t3n-kv-map-entry-set-and-contract-kv-put-500.md`](./t3n-kv-map-entry-set-and-contract-kv-put-500.md).

**Doc gap:** [Common errors](https://docs.terminal3.io/developers/adk/tips/common-errors) documents generic `quota exceeded` but not the 512-byte per-entry KV ceiling.

---

### SDK-001 — `revokeDelegation()` builds a relative URL when `baseUrl` is omitted

| | |
|---|---|
| **Severity** | **major** |
| **Status** | Open in `@terminal3/t3n-sdk@3.9.0` |

**What happens:** Calling `revokeDelegation({ credentialJcsB64u, client })` without `baseUrl` internally calls `getScriptVersion("", "tee:delegation/contracts")`, which becomes `fetch("/api/contracts/current?...")` — an unparseable relative URL in Node.

**Steps to reproduce**

No T3N credentials or network required.

```sh
node --input-type=module -e "
import { revokeDelegation } from '@terminal3/t3n-sdk';
try {
  await revokeDelegation({ credentialJcsB64u: 'dGVzdA', client: {} });
} catch (e) {
  console.error(e.message);
}
"
```

Expected output (verified 2026-06-22):

```text
Failed to parse URL from /api/contracts/current?name=tee%3Adelegation%2Fcontracts
```

**T3Pay impact:** Agent revocation must pass `baseUrl` explicitly — see [`revokeAgentGrant`](../backend/src/modules/t3n/gateway.ts#L394-L406).

---

### SDK-002 — `buildDelegationCredential()` rejects canonical tenant script names

| | |
|---|---|
| **Severity** | **major** |
| **Status** | Open in `@terminal3/t3n-sdk@3.9.0` |

**What happens:** `canonicalTenantName(tenantId, tail)` produces `z:<40-hex-tid>:<tail>` (e.g. 61 chars for `vaultpay-contracts`), but `buildDelegationCredential({ contract })` throws `ContractTooLong` when the contract string exceeds 46 characters. The tail-only name (`vaultpay-contracts`, 18 chars) succeeds.

**Steps to reproduce**

No T3N credentials or network required.

```sh
node --input-type=module -e "
import { buildDelegationCredential, canonicalTenantName } from '@terminal3/t3n-sdk';

const tid = '5c5425b5f633140490d5cf7085ad72997aeb6143';
const canonical = canonicalTenantName(tid, 'vaultpay-contracts');
console.log('canonical:', canonical, '(' + canonical.length + ' chars)');

const base = {
  user_did: 'did:t3n:' + tid,
  agent_pubkey: new Uint8Array(33),
  org_did: 'did:t3n:' + tid,
  functions: ['validate-and-pay'],
  scopes: [],
  metadata: {},
  not_before_secs: 1,
  not_after_secs: 2,
  vc_id: new Uint8Array(16),
};

try {
  buildDelegationCredential({ ...base, contract: canonical });
  console.log('canonical name: UNEXPECTED SUCCESS');
} catch (e) {
  console.log('canonical name:', e.message);
}

try {
  buildDelegationCredential({ ...base, contract: 'vaultpay-contracts' });
  console.log('tail-only name: SUCCESS');
} catch (e) {
  console.log('tail-only name:', e.message);
}
"
```

Expected output (verified 2026-06-22):

```text
canonical: z:5c5425b5f633140490d5cf7085ad72997aeb6143:vaultpay-contracts (61 chars)
canonical name: ContractTooLong
tail-only name: SUCCESS
```

**T3Pay impact:** Grant creation uses the **tail** (`vaultpay-contracts`), not the full canonical script name — see [`createAgentGrant`](../backend/src/modules/t3n/gateway.ts#L308).

---

## 2. Documentation gaps

Four major gaps that blocked or significantly slowed the T3Pay build. Minor onboarding nits (SDK README env vars, step counts, etc.) are omitted.

| ID | Gap | Severity |
|:---:|---|:---:|
| DOC-001 | ADK credential delegation lifecycle undocumented | **major** |
| DOC-002 | `getAuditEvents` / contract logs undocumented | **major** |
| DOC-003 | `http-with-placeholders` snippet does not match WIT bindings | **major** |
| DOC-004 | Official `z-tenant-flight` sample contradicts newer docs | **major** |

### DOC-001 — ADK credential delegation lifecycle is undocumented in developer docs

| | |
|---|---|
| **Severity** | **major** |

**Gap:**

- [Delegate Access](https://docs.terminal3.io/t3n/data-owner-guide/delegate-access) and [Delegate Access to AI Agents](https://docs.terminal3.io/t3n/use-cases/delegate-access-to-agent) describe **Dashboard-only** grants. No SDK functions are named.
- [Invoke contract](https://docs.terminal3.io/developers/adk/get-started/walkthrough/invoke-contract) documents programmatic `agent-auth-update` via `userClient.execute({ script_name: "tee:user/contracts", function_name: "agent-auth-update", ... })` — but not the ADK credential helpers (`buildDelegationCredential`, `signCredential`, `signAgentInvocation`, `revokeDelegation`).
- Full-text search of [llms-full.txt](https://docs.terminal3.io/llms-full.txt) (fetched 2026-06-20): **zero hits** for `getAuditEvents`, `buildDelegationCredential`, `signAgentInvocation`, or `revokeDelegation`.
- [Payroll Agent](https://docs.terminal3.io/developers/adk/use-cases/payroll-agent) is a one-line stub redirecting elsewhere.

**T3Pay impact:** The grant pipeline in [`createAgentGrant`](../backend/src/modules/t3n/gateway.ts#L263-L392) was reverse-engineered from SDK types and [`scripts/grant-agent.mjs`](../scripts/grant-agent.mjs). No official end-to-end walkthrough covers the credential-signing path used from the UI ([`mandates/routes.ts`](../backend/src/modules/mandates/routes.ts#L48-L60)).

---

### DOC-002 — `getAuditEvents` / contract logs are undocumented

| | |
|---|---|
| **Severity** | **major** |

**Gap:** `T3nClient.getAuditEvents` and `tenant.contracts.logs` exist in the SDK but have no developer page. The `committed` flag on audit batches (durable vs in-flight) is only described in TSDoc. Neither appears in [llms.txt](https://docs.terminal3.io/llms.txt) or [llms-full.txt](https://docs.terminal3.io/llms-full.txt).

**T3Pay impact:** Run trace panel and agent audit endpoint ([`agents/routes.ts`](../backend/src/modules/agents/routes.ts#L76-L79)) depend on [`getAgentProof`](../backend/src/modules/t3n/gateway.ts#L409-L426). Builders must discover these from `.d.ts` alone.

---

### DOC-003 — `http-with-placeholders` snippet errors and secrets ref provisioning gap

| | |
|---|---|
| **Severity** | **major** |

**What the docs get right:** The [placeholders page](https://docs.terminal3.io/developers/adk/tips/placeholders-outbound-calls) explains the `{{profile.*}}` model, synchronous behavior, egress gating, and delegation requirements.

**What is still wrong or missing:**

| Issue | Evidence |
|---|---|
| Rust snippet uses `body` | Official snippet: `body: Some(serde_json::to_vec(&body)?)` |
| WIT uses `payload` | [`package.wit`](../contracts/vaultpay/wit/deps/host-interfaces-2.1.0/package.wit#L72-L77): `record request { method: verb, …, payload: option<list<u8>> }` |
| Snippet uses string HTTP method | Snippet: `method: "POST".to_string()` |
| WIT uses `verb` enum | WIT: `enum verb { get, post, put, patch, delete }` |
| No secrets / payment ref provisioning | Docs emphasize `{{profile.*}}` but do not document arbitrary `secrets` map substitution for payment credentials |

**T3Pay impact:** WIT imports `http-with-placeholders`, but settlement uses a **local mock merchant** ([`merchant/service.ts`](../backend/src/modules/merchant/service.ts)). Copy-pasting the official Rust snippet would not compile against current bindings without manual correction.

---

### DOC-004 — Official sample (`z-tenant-flight`) README contradicts source and newer docs

| | |
|---|---|
| **Severity** | **major** |

| Issue | Summary |
|---|---|
| Inline PII model | README: `book-offer` posts "with full passenger PII" — contradicts [invoke-contract](https://docs.terminal3.io/developers/adk/get-started/walkthrough/invoke-contract) and [placeholders-outbound-calls](https://docs.terminal3.io/developers/adk/tips/placeholders-outbound-calls) |
| Obsolete manifest | README still documents `host_capabilities` JSON manifest — [capabilities-from-wit-import](https://docs.terminal3.io/developers/adk/tips/capabilities-from-wit-import) says "there isn't one" |
| Version drift | README says v0.3.0; walkthrough references `travel-contracts` tail |

**T3Pay impact:** Mental model risk during contract design — VaultPay mandates keep payment secrets out of agent context ([`docs/requirements.md`](../docs/requirements.md)).

---

## 3. How these issues shaped T3Pay architecture

| T3Pay decision | Driven by |
|---|---|
| Mandate records kept under 511-byte KV ceiling (contract `0.2.1`) | KV-001 |
| Always pass `baseUrl: getNodeUrl()` on `TenantClient` and `revokeDelegation` | SDK-001 |
| Grant `contract` field uses tail (`vaultpay-contracts`), not full `z:<tid>:…` name | SDK-002 |
| Manual ADK grant pipeline in code (no Dashboard step) | DOC-001 |
| `agent-auth-update` via `executeAndDecode` + separate agent DID derivation | DOC-001; [`deriveAgentSecret`](../backend/src/modules/t3n/gateway.ts#L531-L537) |
| Explicit `.sort()` on grant `functions` and `allowedHosts` | SDK TSDoc (undocumented in developer pages) |
| Deterministic receipt hash instead of SD-JWT VC | DOC-001 |
| Mock merchant in Node, real T3N for policy | DOC-003 |
| Operator scripts under [`scripts/`](../scripts/) | KV-001, DOC-001 |

---

## 4. Recommended filing priority (for upstream Terminal 3)

1. **KV-001** — Return HTTP 400 with quota detail at 512 bytes, or raise limit; document max value size.
2. **DOC-001** — Publish programmatic ADK delegation guide linked from data-owner docs.
3. **SDK-002** — Align `MAX_CONTRACT_LEN` with `canonicalTenantName`, or document delegation `contract` field format for tenant WASM.
4. **DOC-003, DOC-004** — Fix placeholder quick-tip and sample README to match generated bindings and privacy model.
5. **SDK-001** — Default `revokeDelegation` `baseUrl` from authenticated client.
6. **DOC-002** — Document `getAuditEvents` + `contracts.logs` + `committed` semantics.

---

## 5. What is *not* claimed here

- **Handshake does not require `MlKemPublicKey` / `Random` handlers** in current SDK — verified live; not a blocker.
- **One-time WASM path `URL` instance error** — not reproducible.
- **`DelegationCustodialClient`** — not used in T3Pay; we use manual credential + `signAgentInvocation` instead.
- **`sign-sd-jwt-vc` / `outbox`** — not available on active testnet; demo uses receipt hashes.
- **Built-in `tee:payroll` org provisioning** — VaultPay uses a custom `z:<tid>:vaultpay-contracts` contract instead.

---

## 6. Related T3Pay files

| Area | Path |
|---|---|
| T3N gateway (all SDK calls) | [`backend/src/modules/t3n/gateway.ts`](../backend/src/modules/t3n/gateway.ts) |
| WASM contract / policy | [`contracts/vaultpay/src/vaultpay.rs`](../contracts/vaultpay/src/vaultpay.rs) |
| Mandate + grant API | [`backend/src/modules/mandates/routes.ts`](../backend/src/modules/mandates/routes.ts) |
| Agent revoke | [`backend/src/modules/agents/routes.ts`](../backend/src/modules/agents/routes.ts) |
| KV smoke script | [`scripts/map-smoke.mjs`](../scripts/map-smoke.mjs) |
| KV issue (full investigation) | [`issues/t3n-kv-map-entry-set-and-contract-kv-put-500.md`](./t3n-kv-map-entry-set-and-contract-kv-put-500.md) |
| Product requirements | [`docs/requirements.md`](../docs/requirements.md) |

---

## 7. Documentation verification audit (2026-06-20)

Every Terminal 3 documentation URL listed in [`docs/references.md`](../docs/references.md) was fetched or searched. SDK behavior was re-verified against `@terminal3/t3n-sdk@3.9.0`.

### Key findings by doc gap

| Reference URL | Finding |
|---|---|
| [llms-full.txt](https://docs.terminal3.io/llms-full.txt) | Zero hits for `getAuditEvents`, `buildDelegationCredential`, `revokeDelegation` (DOC-001, DOC-002) |
| [Invoke contract](https://docs.terminal3.io/developers/adk/get-started/walkthrough/invoke-contract) | `agent-auth-update` present but credential helpers absent (DOC-001) |
| [Delegate Access](https://docs.terminal3.io/t3n/data-owner-guide/delegate-access) | Dashboard-only workflow (DOC-001) |
| [Placeholders in outbound calls](https://docs.terminal3.io/developers/adk/tips/placeholders-outbound-calls) | Good profile docs; snippet `body`/string method vs WIT `payload`/`verb` (DOC-003) |
| [Common errors](https://docs.terminal3.io/developers/adk/tips/common-errors) | Generic `quota exceeded` only — 512-byte KV ceiling not documented (KV-001) |
| [Terminal-3/z-tenant-flight](https://github.com/Terminal-3/z-tenant-flight) | README teaches inline PII and obsolete manifest (DOC-004) |

### Verdict summary

| ID | Verdict |
|---|---|
| KV-001 | **Confirmed** (platform) — repro via `scripts/map-smoke.mjs` |
| SDK-001 | **Confirmed** — reproduced 2026-06-22 |
| SDK-002 | **Confirmed** — reproduced 2026-06-22 |
| DOC-001 | **Confirmed** — credential helpers absent; `agent-auth-update` partially documented |
| DOC-002 | **Confirmed** — absent from docs index |
| DOC-003 | **Confirmed** — snippet/WIT mismatch; secrets refs undocumented |
| DOC-004 | **Confirmed** — sample README contradicts newer docs |
