# @finora/mcp

Remote MCP server for Finora financial tools.

External agents (ChatGPT, Claude, Cursor) connect here. Tools call `apps/api` — never WeWire.

```bash
# from repo root
pnpm --filter @finora/mcp dev
```

Endpoints (local Wrangler):

- `GET /` — health
- `/mcp` — streamable MCP transport
- `/sse` — SSE transport
