# Finora

The financial operating system for AI agents.

WeWire moves money. Finora powers the intelligence, approvals, and conversation layer.

## Monorepo

```text
finora/
├── apps/
│   ├── mobile/     Expo app (chat-first UI + approvals)
│   ├── api/        Hono backend on Cloudflare Workers
│   └── mcp/        MCP server for ChatGPT / Claude / Cursor
├── packages/
│   ├── shared/     Shared schemas and tool contracts
│   └── wewire/     WeWire HTTP client (server-only)
```

## Prerequisites

- Node.js 20+
- [Bun](https://bun.sh) 1.x
- Cloudflare account (for `api` and `mcp`)
- WeWire sandbox API key (see [WeWire docs](https://docs.wewire.com/))

## Setup

```bash
bun install
```

## Scripts

| Command | What it does |
|---|---|
| `bun run mobile` | Start Expo |
| `bun run api` | Local Finora API Worker |
| `bun run mcp` | Local Finora MCP Worker |
| `bun run typecheck` | Typecheck all packages |

## Architecture

```text
Mobile / external AI agents
            │
            ▼
     apps/api  ◄── apps/mcp (thin tool adapter)
            │
            ▼
   packages/wewire → WeWire APIs
```

Money only moves after authentication, policy checks, and human approval.
