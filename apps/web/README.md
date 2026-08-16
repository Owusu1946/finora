# `@finora/web`

Next.js App Router landing site for Finora.

## Scripts

```bash
# from monorepo root
pnpm dev:web
pnpm build:web
pnpm preview:web
pnpm --filter @finora/web check-types
```

| Command                                 | Expected result                                                             |
| --------------------------------------- | --------------------------------------------------------------------------- |
| `pnpm dev:web`                          | Starts the Turbopack development server on `http://localhost:3000`.         |
| `pnpm build:web`                        | Runs TypeScript and creates the optimized production build in `.next`.      |
| `pnpm preview:web`                      | Serves the existing production build on port `3000`; run `build:web` first. |
| `pnpm --filter @finora/web check-types` | Runs TypeScript without emitting application files.                         |

`dev:web` is included in the root `pnpm dev` session.

## Stack

- Next.js 16 (Turbopack) + package-local React 19.2
- Tailwind CSS v4
- React Compiler enabled

Before writing Next.js code, read the versioned docs under `node_modules/next/dist/docs/` (see `AGENTS.md` in this package).
