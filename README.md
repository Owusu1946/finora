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

Expo Go on a physical device cannot reach the API through `127.0.0.1`. Run the API and its LAN
proxy in separate terminals:

```bash
# Terminal 1 — Hono API on 127.0.0.1:8787
pnpm dev:api
```

```bash
# Terminal 2 — expose the API to the local network on port 8788
pnpm --filter @finora/api dev:lan
```

The proxy should report:

```text
[lan-proxy] http://0.0.0.0:8788 → http://127.0.0.1:8787
```

Set the mobile API URL in `apps/mobile/.env` using your computer's current LAN IPv4 address:

```env
EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:8788
```

Keep the computer and mobile device on the same network, then start Expo in a third terminal:

```bash
pnpm dev:mobile
```

Restart Expo after changing `EXPO_PUBLIC_API_URL`. If Metro has cached the previous value, use:

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
