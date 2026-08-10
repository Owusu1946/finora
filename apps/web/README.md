# `@finora/web`

Next.js App Router landing site for Finora.

## Scripts

```bash
# from monorepo root
pnpm landing          # next dev on :3000
pnpm --filter @finora/web build
pnpm --filter @finora/web check-types
```

## Stack

- Next.js 16 (Turbopack) + React 19.1 (workspace override)
- Tailwind CSS v4
- React Compiler enabled

Before writing Next.js code, read the versioned docs under `node_modules/next/dist/docs/` (see `AGENTS.md` in this package).
