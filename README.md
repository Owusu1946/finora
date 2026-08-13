# finora

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack.

## Features

- **TypeScript** - For type safety and improved developer experience
- **Turborepo** - Optimized monorepo build system
- **Oxlint** - Oxlint + Oxfmt (linting & formatting)

## Getting Started

First, install the dependencies:

```bash
pnpm install
```

Then, run the development server:

```bash
pnpm run dev
```

### Running the mobile app against the local API

Expo Go on a physical device cannot reach the API through `127.0.0.1`. Use two terminals for the
normal development workflow:

```bash
# Terminal 1 — start the workspace, including API and mobile
pnpm dev
```

```bash
# Terminal 2 — expose the API to the local network
pnpm --filter @finora/api dev:lan
```

The proxy should report:

```text
[lan-proxy] http://0.0.0.0:8788 → http://127.0.0.1:8787
```

In Expo development, Finora derives the current LAN host from Metro and uses port `8788`
automatically. You do not need to update the API URL whenever the computer changes networks.

`EXPO_PUBLIC_API_URL` is still required for production builds:

```env
EXPO_PUBLIC_API_URL=https://api.example.com
```

Keep the computer and mobile device on the same network. For focused development, you can start
only the API, LAN proxy, and mobile app in three separate terminals instead:

```bash
pnpm dev:api
```

```bash
pnpm --filter @finora/api dev:lan
```

```bash
pnpm dev:mobile
```

Restart Expo after changing production environment values. If Metro has cached a previous value, use:

```bash
pnpm --filter @finora/mobile exec expo start --clear
```

## Git Hooks and Formatting

- Run checks: `pnpm run check`

## Project Structure

```
finora/
├── apps/
```

## Available Scripts

- `pnpm run dev`: Start all applications in development mode
- `pnpm dev:api`: Start the Hono API on `127.0.0.1:8787`
- `pnpm --filter @finora/api dev:lan`: Expose the local API on LAN port `8788`
- `pnpm dev:mobile`: Start the Expo mobile application
- `pnpm run build`: Build all applications
- `pnpm run check-types`: Check TypeScript types across all apps
- `pnpm run check`: Run Oxlint and Oxfmt
