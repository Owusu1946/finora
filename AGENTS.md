# Finora monorepo

## What we're building

Finora is a financial operating system for AI: a conversational mobile app for people and an MCP server for AI agents, both powered by the same backend.

Users and agents can check balances, review transactions, manage invoices, and prepare payments, transfers, FX conversions, payroll, and other financial actions. AI may prepare actions, but it never moves money on its own. Money movement follows:

`prepare → policy check → human approval → PIN/biometrics → execute → audit`

WeWire provides the underlying financial rails. Much of the current product is still mocked or stubbed, so keep demos honest and do not present unfinished integrations as live.

## Layout

- `apps/mobile` — Expo React Native app (conversation UI)
- `apps/api` — Finora backend (Hono on Cloudflare Workers)
- `apps/mcp` — Finora MCP server (Cloudflare Workers)
- `packages/shared` — shared Zod schemas and types
- `packages/wewire` — WeWire API client (server-only)

## Expo

The mobile app uses Expo SDK 54. Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any mobile code.

React is pinned to `19.1.0` via root `overrides`. After `bun install`, `scripts/link-mobile-deps.mjs` junctions `react` / `react-dom` / `react-native` into `apps/mobile/node_modules` so Metro does not hit an invalid-hook / duplicate-React error.

Mobile UI uses NativeWind v5 + `@assistant-ui/react-native` (not the web `@assistant-ui/react` package).

## Architecture rule

- `apps/api` is the core platform. Mobile and MCP are clients of it and never call WeWire directly.
- MCP exposes a curated set of read and prepare capabilities. It must not expose execution, credentials, PINs, or biometric flows.
- Financial execution belongs behind explicit human approval in the mobile/platform flow.
- Keep shared capability names, schemas, and types in `packages/shared`; avoid redefining contracts in individual apps.
- Keep `packages/wewire` server-only. Never import it into mobile or other client-side code.
- Preserve the distinction between a registry capability, an HTTP endpoint, an MCP tool, and a mobile UI action. They are related, but not interchangeable.

When adding a financial flow, prefer the established `prepare_*` and `execute_approved_*` pattern rather than introducing a direct execution path.

## Tool docs

See [`docs/tools/`](docs/tools/README.md) for the capability registry vs HTTP APIs vs curated MCP tools (and why e.g. `mark_notification_read` is not an agent tool).
