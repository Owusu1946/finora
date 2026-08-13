# @finora/api

Finora backend on Cloudflare Workers (Hono).

Owns auth, approvals, WeWire access, and webhooks.

```bash
# from repo root
cp apps/api/.dev.vars.example apps/api/.dev.vars
pnpm --filter @finora/api dev
```

Database schema changes use Drizzle's direct push workflow (Option 2). Update
`src/db/schema.ts`, review the interactive diff, then apply it without creating
SQL migration files:

```bash
pnpm db:push
```
