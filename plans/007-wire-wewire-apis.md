# Plan 007: Wire live WeWire APIs into the Finora platform

> **Executor instructions**: Follow the phases in order. Each phase ends with
> verification; run every command listed. Stop on any STOP condition and
> report. Update `plans/README.md` when the whole plan lands.
>
> **Drift check**: `git diff --stat HEAD~1..HEAD -- packages/wewire apps/api`

## Status

- **Priority**: P1
- **Effort**: XL
- **Risk**: HIGH
- **Depends on**: none hard; Phase 6 assumes plan 002's approval-binding work
  conceptually but does not block on it landing first
- **Category**: integration / architecture
- **Planned at**: 2026-08-26, against verified docs at `docs.wewire.com`
- **Sandbox keys**: pending (Haadi sourcing `sk_test_` keys). Phases 0–1 are
  fully executable without them; live verification from Phase 2 onward needs
  them in `.dev.vars`.

## Decisions locked at planning time

1. **Entity model**: personal Finora accounts map to one WeWire sub-customer
   per Finora user. Business-level operations (rates, business wallets) use the
   top-level business surface. This means payout/disbursement calls carry
   `subCustomerId` where the endpoint supports it so funds move against the
   user's balance, not the platform's.
2. **Corridor policy**: Ghana-rail destinations always use the dedicated
   Ghana endpoints (`POST /v1/collections`, `POST /v1/disbursements`,
   `GET /v1/account-lookup`). Everything else uses generic/sub-customer
   endpoints. Never both for one movement.
3. **No migrations generated or pushed by the executor.** Schema changes land
   as Drizzle schema edits only; Haadi runs `db:push`.
4. Mock mode stays as an env-gated fallback. Demos stay honest about mode.
5. MCP stays read/prepare-only. No WeWire imports outside `apps/api`. No new
   execution tools anywhere.

## Verified facts that shape the implementation

These were confirmed against `docs.wewire.com` on 2026-08-26 and override any
assumptions in older code:

- Auth header is `ww-api-key` (no Bearer). Sandbox base
  `https://stage-capi.wewireafrica.com`, production `https://capi.wewire.com`,
  all paths under `/v1/`.
- Idempotency is a **body field** `idempotencyKey`, required on every
  execution-class endpoint (payouts, conversions, transfers, sweeps, MoMo
  collect/disburse, wallet withdrawals, Ghana corridor). Replay semantics
  differ per family: initiate-payout rejects reuse; Ghana pay-out returns the
  original transaction. Treat keys as write-once intents derived from the
  preparation ID either way.
- All list endpoints return `{ data, totalItems, totalPages, currentPage,
pageSize }` with `page`/`limit` query params (limit max 1000). The current
  client casts bare arrays — wrong.
- Existing client paths that are wrong vs docs:
  - `getPairRate` uses `/v1/rates/:from/:to`; docs say
    `GET /v1/rates/pair?from=&to=`.
  - `executeConversion /v1/conversions/execute` does not exist; conversions
    execute at `POST /v1/subcustomers/{id}/conversions` (preview at
    `.../conversions/preview`).
  - `getKycRequirements` path must be re-checked (`/kyc-requirements` vs
    `/kyc/requirements`) during Phase 0.
- No FX quotes are locked. Rates refresh ~30 min; settlement rate resolves at
  execution time. Re-fetch the pair rate immediately before execute; previews
  are estimates only.
- Crypto wallets provision asynchronously: usable only after the
  `subcustomer.wallet.created` webhook fires.
- KYC has two independent tracks: onboarding (`subcustomer.kyc_status_updated`)
  and Enhanced Due Diligence (`subcustomer.enhanced_kyc_status_updated`). USD
  account requests fail with `SUBCUSTOMER_ENHANCED_KYC_REQUIRED` until EDD is
  `APPROVED` or `EXEMPT`.
- Rate limits per key: rates 100 req/min; `POST /v1/transactions/initiate-payout`
  10 req/30s (payroll batches must serialize and retry with the same
  idempotency key).
- Webhooks follow the Standard Webhooks spec: headers `webhook-id`,
  `webhook-timestamp`, `webhook-signature` (`v1,<base64>` space-separated);
  signed content `{id}.{timestamp}.{rawBody}`; HMAC-SHA256 base64;
  constant-time compare; reject timestamps older than 5 minutes; verify raw
  bytes before parsing; rotation keeps old secret valid 24h. Delivery is
  at-least-once and unordered — dedupe on resource ID + status/updatedAt.
- Error envelope: `{ success: false, error: { code, message, statusCode,
details? } }`. Branch on `code` (`INSUFFICIENT_BALANCE`,
  `SUBCUSTOMER_ENHANCED_KYC_REQUIRED`, `INTEGRATION_TIMEOUT` = outcome unknown,
  reconcile don't retry, etc.). Retry only 5xx with backoff + jitter.
- Ghana corridor returns `202 Accepted` (async); statuses move
  `PENDING → SUCCESSFUL | FAILED | REVERSED | CANCELLED` via webhooks. Sandbox
  deterministic test numbers exist (e.g. MTN `0240000001` succeeds,
  `0240000002` fails).
- Anomaly to remember: account deletion path omits beneficiaryId —
  `DELETE /v1/beneficiaries/accounts/{accountId}`.

## Current state (audit summary, 2026-08-26)

- `WewireClient` (`packages/wewire/src/client.ts`) wraps ~20 methods; zero
  instantiations repo-wide; every financial route in
  `apps/api/src/routes/v1.ts` serves mock data from `mock/store.ts` with
  `"mode": "mock"` in responses.
- Approvals/preparations are in-memory only (`createPreparation`,
  `mock/store.ts:540`). `POST /approvals/:id/resolve` fakes execution by
  minting `WW…` IDs (`v1.ts:685`). No `execute_approved_*` HTTP handlers
  exist though the shared registry defines nine.
- No DB tables for preparations, approvals, policies, notifications, or
  general audit. Only payroll has real persistence plus a scoped
  `payroll_audit_events` table.
- `POST /v1/webhooks/wewire` (`index.ts:57`) logs and acks without signature
  verification.
- Env plumbing exists: `WEWIRE_API_KEY` / `WEWIRE_WEBHOOK_SECRET` declared
  optional in `packages/env/src/api.ts`, plumbed via `apps/api/src/env.ts`,
  empty in `.dev.vars`. Nothing consumes them. No mode/environment variable.
- MCP is clean: filtered to read|prepare registry rows, calls Finora API with
  forwarded Clerk bearer, never imports `@finora/wewire`.

## Commands you will need

| Purpose          | Command                                    | Expected |
| ---------------- | ------------------------------------------ | -------- |
| Workspace check  | `pnpm check && pnpm check-types`           | exit 0   |
| wewire package   | `pnpm --filter @finora/wewire check-types` | exit 0   |
| API typecheck    | `pnpm --filter @finora/api check-types`    | exit 0   |
| Shared typecheck | `pnpm --filter @finora/shared check-types` | exit 0   |

## Scope

**In scope**: `packages/wewire` client rebuild, `apps/api` route wiring +
webhook receiver + approval execution handlers + Drizzle schema additions,
`packages/shared` schemas for approvals/preparations/transactions, env plumbing.

**Out of scope**: mobile UI rework beyond what plan 002 covers, MCP tool
changes, payroll/invoice feature work, generating or pushing migrations,
production keys.

---

## Phase 0 — Rebuild `packages/wewire` against verified docs

1. Rewrite `client.ts` transport layer:
   - Pagination-aware request helper returning `{ data, totalItems,
totalPages, currentPage, pageSize }` envelopes.
   - Typed `WewireError extends Error` carrying `code`, `statusCode`,
     `details[]` parsed from the documented error envelope.
   - Timeout on every request; retry only 5xx with exponential backoff +
     jitter; honor `Retry-After` on 429; never retry 4xx.
2. Fix wrong paths (`rates/pair`, conversions), then add missing typed methods
   grouped as: beneficiaries + accounts CRUD; KYC document upload + full
   beneficial-owner CRUD; sub-customer accounts (request/list/get/suspend/
   reactivate); wallets create/get, deposit addresses issue/list, virtual
   accounts issue/list, withdraw, wallet transactions; MoMo collection;
   explicit bank disbursement; sweep-in/out; auto-sweep get/update (per
   sub-customer and business default); supported assets; Ghana adapter group
   (collections, disbursements, account lookup).
3. Add `idempotencyKey` to every execution-class input type.
4. Replace hand-written interfaces with Zod schemas for responses we actually
   consume (wallet, transaction, sub-customer, rate, conversion preview,
   webhook event envelope). Export both the schemas and inferred types from
   `index.ts`.
5. Add a standalone `verifyWebhookSignature({ secret, id, timestamp, body,
signatures })` helper implementing Standard Webhooks verification
   (constant-time compare, 5-minute timestamp tolerance).

**STOP if**: any doc page contradicts a path used here — re-fetch the page and
resolve before writing the method.

## Phase 1 — Persistence spine in `apps/api`

1. Add Drizzle tables to `db/schema.ts` (schema edits only — Haadi runs
   `db:push`):
   - `preparations`: id, user_id, kind, payload (jsonb), status, agent context,
     created/resolved timestamps.
   - `approvals`: id, preparation_id, user_id, status, resolved_by, resolved_at.
   - `financial_audit_events`: id, user_id, preparation_id, event type, detail
     jsonb, created_at. Append-only.
   - `wewire_refs`: preparation_id ↔ wewire transaction/collection/disbursement
     id, endpoint family, environment, idempotency_key (unique), status.
2. Introduce `WEWIRE_MODE` (`mock` | `live`, default `mock`) in
   `packages/env/src/api.ts`; live requires `WEWIRE_API_KEY` present. Add a
   `getWewireClient()` factory in `apps/api` reading env + mode.
3. Move `createPreparation` and approval resolve off the mock store onto the
   new tables. Keep mock-mode behavior working (mock store can remain for demo
   data like wallets/transactions, but preparations/approvals persist).
4. Add the server-side PIN/biometric checkpoint: approval resolution accepts
   proof-of-presence input and records it in the audit trail. Exact scheme
   follows whatever plan 002 landed; do not invent a second standard.

**STOP if**: `pnpm --filter @finora/api check-types` fails after schema edit,
or existing routes regress under mock mode.

## Phase 2 — Mode switch + low-risk reads live

Flip behind the mode switch, mapping mock routes to live calls with graceful
degradation (live error → typed 502 with WeWire code surfaced):

- `GET /wallets`, `/balances` → business + sub-customer wallet listing.
- `GET /transactions`, `/transactions/:id` → paginated list/get.
- `GET /rates`, `/rates/:from/:to` → list-rates / pair-rate.
- Capabilities assets/rails reads → `supported-assets` where applicable.

Every response reports its true `mode`. Keep all prepare/approval routes mock
until Phase 6.

## Phase 3 — Onboarding & KYC

1. Map Finora signup → lazy sub-customer provisioning (one per user, purpose
   `PAYOUT` + `COLLECTION`), storing the WeWire sub-customer ID on the user
   profile row.
2. Wire individual KYC submit, hosted KYC link, requirements, submit-for-review.
3. Wire business KYC: company details questionnaire, document upload,
   beneficial-owner CRUD, submit-for-review, structured resubmission feedback.
4. Extend `POST /v1/webhooks/wewire` into a real receiver (Phase 5 builds the
   full dispatcher; here, verify signatures and persist KYC status events).

## Phase 4 — Receive rails

Per-user, gated on KYC `APPROVED`:

- Account request/list/get (respect country risk tiers and EDD gating errors).
- Virtual-account issuance/listing on wallets.
- Crypto wallets + multi-chain deposit addresses; readiness driven by
  `subcustomer.wallet.created/failed` webhooks, not the POST response.
- Simulate-deposit exposed only when `WEWIRE_MODE=mock` or environment is
  sandbox — never reachable in production config.

## Phase 5 — Beneficiaries, lookups, webhook dispatcher

1. Beneficiary + beneficiary-account CRUD mapped to Finora contacts/beneficiary
   surfaces. Mutations stay platform/mobile capabilities — MCP gets search/read
   only (already true; keep it).
2. Ghana `account-lookup` powers name-resolution endpoints currently stubbed
   (`/lookup/bank`, `/lookup/mobile-money`) for GHS/NGN destinations.
3. Full webhook dispatcher: route each documented event to a handler updating
   `wewire_refs`, transactions cache, approvals, and audit events. Dedupe on
   resource ID + status. Handle `transaction.status_updated`,
   `collection.*`, `disbursement.*`, `subcustomer.*`, `virtual_account.*`.

## Phase 6 — Execution behind approvals

Implement HTTP handlers for the nine registry `execute_approved_*`
capabilities. Common shape: load preparation → assert approval `approved` +
PIN proof present → derive stable `idempotencyKey` from the preparation ID →
re-fetch pair rate for FX legs → call the correct WeWire execution method →
persist `wewire_refs` + audit events → return settlement reference.

Mapping:

| Handler kind                        | WeWire call                                            |
| ----------------------------------- | ------------------------------------------------------ |
| payment / bank_transfer             | `initiate-payout` (offshore) or Ghana `pay-out`        |
| momo_disbursement                   | sub-customer MoMo disburse or Ghana disbursement       |
| internal_transfer / wallet_transfer | sub-customer transfer                                  |
| conversion                          | sub-customer conversions                               |
| invoice_payment / supplier_payment  | payout against stored beneficiary                      |
| payroll                             | batched payouts, serialized ≤10/30s, same key on retry |
| recurring                           | scheduled preparation fan-out                          |

Add MoMo collection (`collect_approved_*` equivalent) as a new preparation kind
using the Ghana collection endpoint. Remove the synthetic `WW…` minting from
the mock resolve path once live handlers exist for a kind.

## Phase 7 — Client alignment

- Mobile approvals inbox onto persisted `/approvals` data; execution status
  from `wewire_refs`-backed endpoints rather than local fabrication.
- Add the missing notification mark-read route the catalog promises.
- Update `docs/tools/catalog.md` and `docs/wewire-api-coverage.md` statuses.

## Verification per phase

- Phase 0–1: `pnpm check && pnpm check-types` green; mock-mode routes behave
  identically to today for demos.
- Phase 2+: with sandbox keys set, hit each flipped route through the running
  API and confirm live payloads; confirm `mode` field honesty.
- Phase 6: dry-run each execution handler in sandbox using deterministic test
  numbers (MTN `0240000001` success, `0240000002` failure); verify reversal
  handling on `0240000002`; verify duplicate submission with the same
  idempotency key does not double-move funds.

## Findings considered and rejected

- Wrapping WeWire SDKs/postman collections — none published that match the
  current API; our own typed client is the right vehicle.
- Storing WeWire quotes and honoring them at execute — impossible; rates are
  not lockable, so quotes stay preview-only UX.
- Exposing sweep/auto-sweep in v1 — deferred; advanced treasury, no product
  surface yet. Registry rows can wait.
