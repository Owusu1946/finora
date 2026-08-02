# Finora monorepo

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

Mobile and MCP never call WeWire directly. All money movement goes through `apps/api`.
