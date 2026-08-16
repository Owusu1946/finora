# @finora/mcp

Remote MCP server for Finora financial tools.

External agents (ChatGPT, Claude, Cursor) connect here. Tools call `apps/api` — never WeWire.

Run commands from the repository root:

| Command                                 | Expected result                                                                          |
| --------------------------------------- | ---------------------------------------------------------------------------------------- |
| `pnpm dev:mcp`                          | Starts MCP on `http://127.0.0.1:8789` with DevTools on port `9231`.                      |
| `pnpm build:mcp`                        | Bundles and validates the Worker with `wrangler deploy --dry-run`; nothing is published. |
| `pnpm deploy:mcp`                       | Publishes the MCP Worker to Cloudflare.                                                  |
| `pnpm --filter @finora/mcp cf-typegen`  | Regenerates Cloudflare Worker types.                                                     |
| `pnpm --filter @finora/mcp check-types` | Runs TypeScript without emitting files.                                                  |

`dev:mcp` is included in the root `pnpm dev` session. Its own server listens on port `8789`, while
`FINORA_API_URL` points to the API on port `8787`. Start `pnpm dev:api` as well when exercising
tools that call the backend.

Endpoints (local Wrangler):

- `GET http://127.0.0.1:8789/` - health
- `http://127.0.0.1:8789/mcp` - streamable MCP transport
- `http://127.0.0.1:8789/sse` - SSE transport
