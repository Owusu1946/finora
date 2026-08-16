# @finora/env

Shared T3 Env schemas for Finora's different runtimes.

- `@finora/env/api` validates Cloudflare bindings for the API Worker.
- `@finora/env/mcp` validates Cloudflare bindings for the MCP Worker.
- `@finora/env/mobile` validates Expo's statically referenced public variables.
- `@finora/env/drizzle` validates the Node environment used by Drizzle Kit.

Each app passes its runtime values explicitly. This keeps server secrets out of
client bundles and avoids treating non-string Cloudflare bindings as variables.

## Verification

From the repository root, run:

```bash
pnpm --filter @finora/env check-types
```

This package has no dev server or build output. The root `pnpm check-types` command includes it
automatically.
