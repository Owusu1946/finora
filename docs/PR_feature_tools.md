# feat: add three-surface tool registry, MCP subset, and financial plan UI

Introduce shared TOOL_REGISTRY (mobile/platform/mcp), curated MCP prepare-only
tools, API stubs for plans/policy/capabilities, Approvals multi-item plan UI,
and docs/tools clarifying tools vs APIs.

---

## Summary

- Adds a three-surface Finora tool registry (`mobile` / `platform` / `mcp`) in `@finora/shared`, with snake_case canonical ids, risk levels (`read` | `prepare` | `execute` | `local`), and camelCase aliases.
- Curates MCP to a high-level prepare/read set only (no money execution); maps tools to Finora `/v1/*` mocks. Money path stays prepare → Approvals + PIN → `execute_approved_*`.
- Extends API mocks (plans, agent transactions, policy, capabilities, payment status, context, etc.).
- Ships multi-item **financial plan** UX in Approvals + chat (`create_financial_plan`, “pay everything due today”).
- Adds developer docs under `docs/tools/` explaining tools vs HTTP APIs vs MCP (e.g. why `mark_notification_read` is not an agent tool).

## Motivation

Align the product with Finora Vision: Expo for humans, MCP for external agents, shared backend. Agents must never settle rails; platform stays rich; MCP stays small and safe.

## What’s included

### Shared registry & schemas

- `packages/shared/src/registry.ts` — full catalog + `PLATFORM_TOOL_NAMES` / `MCP_TOOL_NAMES` / `MOBILE_TOOL_NAMES`
- `packages/shared/src/tools.ts` — Zod inputs for curated MCP tools + named schemas for platform capabilities
- Consistent prepare/execute naming (`prepare_payroll` → `execute_approved_payroll`, etc.)

### MCP

- Registers **only** `MCP_TOOL_NAMES` (~23 tools)
- Catalog maps to prepare/list/status/capability routes — no `execute_*` / PIN / auth mutation

### API mocks

- Plans, agent begin/commit/rollback, policy check/CRUD stubs, capabilities, payment status, recent context, invoice source email, supplier/payroll prepare, etc.

### Mobile

- Approvals: `kind: 'payment' | 'plan'`, plan list/detail card, Approve all + passcode
- Chat: `create_financial_plan` tool UI + mock adapter triggers
- Approvals storage key bump (`finora.approvals.v2`) for new seed data

### Docs

- `docs/tools/README.md` — tools vs APIs
- `docs/tools/catalog.md` — full registry by category
- `docs/tools/mcp.md` — agent-facing subset
- `docs/tools/mobile.md` — Expo chat tools today
- Pointers from `AGENTS.md` and `packages/shared/README.md`

## Architecture (money)

```text
MCP/mobile prepare_* | create_financial_plan | begin_transaction
  → evaluate_policy (optional)
  → request_approval / commit_transaction
  → human Approvals + PIN
  → execute_approved_* (platform/mobile only)
  → audit → WeWire
```

## Test plan

- [ ] `pnpm --filter @finora/shared check-types`
- [ ] `pnpm --filter @finora/mcp check-types`
- [ ] `pnpm --filter @finora/api check-types`
- [ ] API: `GET /` lists platform tools; `POST /v1/plans` returns plan + pending approval
- [ ] MCP: only curated tools registered; `ping` notes prepare-only; no execute money tools
- [ ] Mobile Approvals: pending “Pay everything due today” plan → Approve all + passcode → activity entry
- [ ] Chat: “pay everything due today” / “pay everyone” renders plan card
- [ ] Single-payment approvals still work
- [ ] Skim `docs/tools/README.md` — `mark_notification_read` called out as non-MCP

## Out of scope / follow-ups

- Live WeWire behind every platform tool
- Syncing `POST /v1/plans` into mobile Approvals storage
- Per-line approve/reject inside a plan
- Wiring every registry capability into mobile chat
