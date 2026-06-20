# T3N ADK: `map-entry-set` and contract-side KV writes return HTTP 500 for VaultPay mandate payloads

## Status

Workaround validated. Underlying T3N single-entry write issue remains open.

This looks like a T3N runtime/API-side issue from the client perspective because the same authenticated tenant, contract, map, and control path can write values up to 511 bytes, while 512-byte and larger values return `HTTP 500: Internal error`. The public docs say tenant/map problems should return HTTP 400 `bad_request` with a useful detail, and the reported tenant quota is far larger than 512 bytes.

## Impact

VaultPay cannot complete the real end-to-end contract flow until mandate state can be persisted in real T3N tenant storage.

The working part:

- T3N authentication works with the provided DID/key.
- The tenant is active on testnet.
- The Rust WASM contract builds and registers on T3N.
- T3N maps can be created/updated with contract ACLs.
- Agent/self grant through `tee:user/contracts::agent-auth-update` works.
- `create-mandate` can be invoked as a real T3N contract call and returns the validated mandate payload.
- Small `TenantClient.executeControl("map-entry-set", ...)` writes work.

The failing part:

- Persisting a full mandate payload through `TenantClient.executeControl("map-entry-set", ...)` fails with T3N `HTTP 500` because the mandate JSON is currently about 594 bytes.
- Earlier contract-side writes through the `host:interfaces/kv-store` `put` import also failed with T3N `HTTP 500`.
- Because `validate-and-pay` reads the mandate through real T3N `kv-store::get`, the full E2E flow cannot proceed until persistence is made real and reliable.

Resolved for VaultPay:

- Mandates are now stored as multiple small T3N KV entries.
- Each chunk is written through real `TenantClient.executeControl("map-entry-set", ...)`.
- The count entry is written last as `<mandate-id>.__chunks`.
- The contract reads chunks through real `host:interfaces/kv-store.get` and reconstructs the mandate inside T3N.
- `validate-and-pay` now works on the reconstructed mandate without local storage or a simulator.

## Product Boundary

Per VaultPay requirements:

- The merchant/payment provider may be local and mocked for demo.
- T3N auth, tenant maps, storage, contract registration, contract invocation, delegation, audit/log behavior, and policy enforcement must not be mocked or simulated.
- If real T3N storage cannot be made to work, stop and document it rather than silently falling back to local storage.

## Environment

- Project: `/Users/sam/T3Pay`
- Date observed: 2026-06-20
- Network: T3N testnet
- SDK: `@terminal3/t3n-sdk@3.9.0`
- Node: `>=18` project requirement
- Rust: `rustc 1.92.0`, `cargo 1.92.0`
- WASM target: `wasm32-wasip2`
- WASM inspection tool: `wasm-tools 1.252.0`
- Tenant/user/agent DID for demo: configured in `.env` as `DID`
- Contract tail: `vaultpay-contracts`
- Latest failing single-entry contract version at time of issue: `0.1.2`
- Latest failing single-entry contract id at time of issue: `254`
- Workaround contract version: `0.1.3`
- Workaround contract id: `282`

Do not paste the API key into this issue.

## Relevant Files

- `contracts/vaultpay/src/vaultpay.rs`
- `contracts/vaultpay/src/lib.rs`
- `contracts/vaultpay/wit/world.wit`
- `contracts/vaultpay/wit/deps/host-interfaces-2.1.0/package.wit`
- `scripts/lib/t3n-client.mjs`
- `scripts/register-contracts.mjs`
- `scripts/create-maps.mjs`
- `scripts/grant-agent.mjs`
- `scripts/create-mandate-probe.mjs`
- `scripts/map-smoke.mjs`
- `scripts/invoke-contract-demo.mjs`

## What The Current Contract Does

`create-mandate`:

1. Accepts a JSON input envelope `{ mandate }`.
2. Validates/deserializes it.
3. Calculates `mandate_hash`.
4. Returns the full mandate JSON from the real T3N contract call.
5. Does not currently write to KV in version `0.1.2`, because the earlier contract-side write path produced T3N 500s.

`validate-and-pay`:

1. Accepts mandate id, app agent id, merchant id, category, amount, and payment method.
2. Uses `host:interfaces/kv-store.get` inside the WASM contract to read the mandate from `z:<tenant-id>:mandates`.
3. Enforces policy in the contract.
4. Returns approved/rejected/pending decision.

## T3N Setup That Worked

Authentication smoke test:

```sh
node scripts/t3n-auth-check.mjs
```

Observed result:

- Authenticated successfully on testnet.
- DID returned by T3N matched the configured DID.
- Tenant status was active.
- Tenant quotas were returned.

Contract registration:

```sh
bash scripts/build-contracts.sh
node scripts/register-contracts.mjs
```

Observed registrations:

- `0.1.0` returned contract id `252`
- `0.1.1` returned contract id `253`
- `0.1.2` returned contract id `254`

Map creation / ACL update:

```sh
node scripts/create-maps.mjs
```

Observed maps:

- `z:<tenant-id>:mandates`
- `z:<tenant-id>:audit`
- `z:<tenant-id>:approvals`
- `z:<tenant-id>:receipts`
- `z:<tenant-id>:secrets`

ACLs were updated to use contract id `254` as reader/writer.

Agent/self grant:

```sh
node scripts/grant-agent.mjs
```

Observed transaction:

```text
tx:302:50972
```

Create-mandate real contract probe:

```sh
node scripts/create-mandate-probe.mjs
```

Observed result:

- Real `TenantClient.contracts.execute(...)` call succeeded.
- Result was a normal object.
- Returned mandate payload length was approximately `594` JSON bytes.
- Returned object included `mandate_hash`.

Small map write smoke test:

```sh
node scripts/map-smoke.mjs
```

Observed result:

- `TenantClient.executeControl("map-entry-set", ...)` succeeded for a small JSON value shaped like `{ ok: true, key }`.

## Failure 1: Contract-side `kv_store::put` returned T3N HTTP 500

Earlier contract version attempted to persist the mandate from inside `create-mandate` using `host:interfaces/kv-store.put`.

Observed logs before failure:

```text
create-mandate: storing mandate_demo_...
kv put mandate: map=z:50b5ec33c43d0749ea638f46dc837963f34b7c6a:mandates key=mandate_demo_...
```

Observed error:

```text
HTTP 500 Internal error
```

Captured request id example:

```text
5f75d9d8-0538-4693-b385-4b64e16e24e3
```

Expected behavior:

- If the contract has write permission on `z:<tenant-id>:mandates`, `kv_store::put` should persist the mandate.
- If the contract lacks write permission or uses the wrong map name, T3N should return a typed/access error, not an internal 500.

Actual behavior:

- T3N returned HTTP 500.

## Failure 2: Tenant control `map-entry-set` fails for full mandate payload

Current contract version `0.1.2` avoids contract-side `put`. The script persists the returned mandate through tenant control:

```js
await tenant.executeControl("map-entry-set", {
  map_name: tenant.canonicalName("mandates"),
  key: mandate.mandate_id,
  value: JSON.stringify(created),
});
```

Reproduction:

```sh
node scripts/invoke-contract-demo.mjs
```

Expected behavior:

1. `create-mandate` succeeds.
2. Tenant control writes returned mandate JSON into `z:<tenant-id>:mandates`.
3. `read-mandate` reads the mandate through contract-side `kv_store::get`.
4. `validate-and-pay` reads the same mandate and returns an approval decision.

Actual behavior:

- Step 1 succeeds.
- Step 2 fails with T3N HTTP 500 before `read-mandate` or `validate-and-pay` can run.

Captured error example for a mandate-shaped control write:

```text
HTTP 500: Internal error [750abc91-1ac6-46db-9144-eccca288e000]
```

## Failure 3: Long simple values fail at 512 bytes

The same `map-entry-set` control path was tested with a simple long value:

```sh
VAULTPAY_SMOKE_VALUE_KIND=long node scripts/map-smoke.mjs
```

At first, `long` used:

```js
"x".repeat(600)
```

Observed result:

- T3N returned HTTP 500.

Additional sweep on 2026-06-20:

| Value bytes | Result |
| ---: | --- |
| 128 | Success |
| 256 | Success |
| 384 | Success |
| 448 | Success |
| 480 | Success |
| 500 | Success |
| 501 | Success |
| 511 | Success |
| 512 | `HTTP 500 internal_error` |
| 513 | `HTTP 500 internal_error` |
| 600 | `HTTP 500 internal_error` |

Captured request ids:

```text
175c53b4-256f-4128-a650-41bad48ec958  # 600 bytes
ff2b8611-dfcb-4fb9-b0b9-2214613495d1  # 512 bytes
5cb46a49-c7ae-4781-8c54-593d54811897  # 513 bytes
```

This strongly suggests a real T3N `map-entry-set` value-size bug or undocumented 511-byte limit. If the 511-byte limit is intentional, the platform should return a documented HTTP 400 quota/validation error rather than HTTP 500.

## Why This Looks T3N-side From The Client Perspective

Evidence pointing away from a simple VaultPay auth/setup bug:

- T3N auth succeeds.
- Tenant is active.
- Contract registration succeeds.
- Map creation and ACL updates succeed.
- Contract invocation succeeds for `create-mandate`.
- Small `map-entry-set` writes succeed.
- The map name uses `tenant.canonicalName("mandates")` on the SDK side.
- The contract computes map name as `z:<hex tenant did>:mandates`, matching observed T3N namespace format.
- The reported tenant quota includes a much larger max value size than the failing payload size.
- Failure is returned as HTTP 500 internal error instead of a documented client-side validation, ACL, quota, or map-not-found error.

Evidence still to investigate before filing upstream:

- Whether `executeControl("map-entry-set")` expects a non-string value, base64 bytes, or another envelope shape for larger values.
- Whether `kv-store.put` value/key types need exact byte handling different from the generated binding usage.
- Whether map ACL should include tenant/user access in addition to contract id for `executeControl`.
- Whether private map writes through control have a currently undocumented small value limit.
- Whether newer docs or examples show a different persistence pattern.

## Current Hypothesis

Most likely:

- T3N testnet currently has an internal failure for `map-entry-set` values at or above 512 bytes.

Alternative possibilities:

- The ADK request shape for `map-entry-set` is more constrained than docs indicate.
- Contract-side `kv_store::put` requires a different key/value conversion or ACL pattern.
- Private map ACLs with only contract id as reader/writer allow contract reads/writes but not tenant control writes for larger payloads, although this would normally be expected to produce an access error.

## Reproduction Steps From Clean Project State

1. Install dependencies:

```sh
npm install
```

2. Configure `.env`:

```sh
T3N_API_KEY=<developer private key>
DID=<tenant DID>
T3N_ENVIRONMENT=testnet
VAULTPAY_CONTRACT_TAIL=vaultpay-contracts
VAULTPAY_CONTRACT_VERSION=0.1.2
VAULTPAY_CONTRACT_ID=254
```

3. Build contract:

```sh
bash scripts/build-contracts.sh
```

4. Register contract if needed:

```sh
node scripts/register-contracts.mjs
```

5. Create/update maps:

```sh
node scripts/create-maps.mjs
```

6. Grant agent/self access:

```sh
node scripts/grant-agent.mjs
```

7. Confirm contract invocation succeeds:

```sh
node scripts/create-mandate-probe.mjs
```

8. Confirm small control write succeeds:

```sh
node scripts/map-smoke.mjs
```

9. Reproduce large/simple value failure:

```sh
VAULTPAY_SMOKE_VALUE_KIND=long VAULTPAY_SMOKE_LONG_LEN=600 node scripts/map-smoke.mjs
```

10. Reproduce full demo persistence failure:

```sh
node scripts/invoke-contract-demo.mjs
```

## Immediate Debugging Plan

1. Binary-search the real `map-entry-set` value size threshold using `VAULTPAY_SMOKE_LONG_LEN`.
2. Check official Terminal 3 docs and examples for a different map write shape.
3. Inspect `@terminal3/t3n-sdk@3.9.0` implementation and declarations for hidden constraints.
4. Test whether adding the tenant/user as an allowed map writer changes control write behavior.
5. Test whether a compact/split mandate representation lets real T3N KV persist the full state in multiple smaller entries.
6. If split storage works, update the contract to read multiple real T3N KV entries and compose the mandate inside the TEE.
7. If no real T3N storage write path works, stop the build and escalate this issue upstream.

## Acceptable Workaround

Acceptable:

- Store mandate state in real T3N KV as smaller chunks if the issue is a per-entry value-size problem.
- Use tenant control `map-entry-set` to write small chunks, then use contract-side `kv_store::get` to read them.
- Keep all policy enforcement inside the real T3N contract.
- Document the chunking workaround and the reason it exists.

Not acceptable:

- Local TEE simulator.
- Local mandate storage as a replacement for T3N KV.
- Fake T3N contract execution.
- Fake registration/delegation/auth.
- Client-side policy enforcement presented as contract enforcement.

## Workaround Status

Validated live on T3N testnet.

The current candidate workaround is a chunked mandate storage format:

- Write `<mandate-id>.__chunk.<index>` entries through real `map-entry-set`.
- Write `<mandate-id>.__chunks` as the chunk count after all chunk writes succeed.
- Update `read-mandate` and `validate-and-pay` to read those entries via real `kv_store::get` inside the WASM contract and reassemble the original mandate JSON inside the TEE.
- Preserve the full mandate hash and audit trail.

This is not a mock because storage and reads still happen through T3N; it only changes the data layout.

Implemented files:

- `scripts/lib/t3n-kv-chunks.mjs`
- `scripts/invoke-contract-demo.mjs`
- `contracts/vaultpay/src/vaultpay.rs`
- `contracts/vaultpay/Cargo.toml`
- `contracts/vaultpay/src/lib.rs`

Validation commands run successfully:

```sh
bash scripts/build-contracts.sh
node scripts/register-contracts.mjs
node scripts/create-maps.mjs
node scripts/grant-agent.mjs
VAULTPAY_KV_CHUNK_SIZE=128 node scripts/invoke-contract-demo.mjs
```

Observed live result:

- Registered contract `vaultpay-contracts@0.1.3` as contract id `282`.
- Updated map ACLs to contract id `282`.
- Granted functions through code with transaction `tx:302:53070`.
- Wrote five mandate chunks of `128, 128, 128, 128, 89` bytes plus one count entry.
- `read-mandate` reconstructed the full mandate through contract-side `kv_store::get`.
- `validate-and-pay` returned:

```json
{
  "decision": "approved",
  "reason": null
}
```

## Final Workaround Decision

Use chunked T3N KV storage for any VaultPay tenant map value that may exceed 511 bytes.

Default chunk size:

```text
128 bytes
```

Reasoning:

- 128 bytes is well below the observed 512-byte failure boundary.
- It leaves room for future non-ASCII or envelope overhead differences.
- It keeps the workaround simple and fully inside real T3N storage.

This does not bypass T3N or simulate storage. It only bypasses the currently failing single-entry payload size by using multiple real T3N KV entries.
