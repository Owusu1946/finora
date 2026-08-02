# Finora Agent Instructions

"You" refers to the agent working in this repository. "I/Me" refers to the user/developer instructing/supervising the Agent.
"We" (You and I) are working on this together. Here are some rules for you to follow for us to have a successful co-operation:

## Workspace

### Layout

- `apps/mobile` — Expo React Native app (conversation UI)
- `apps/api` — Finora backend (Hono on Cloudflare Workers)
- `apps/mcp` — Finora MCP server (Cloudflare Workers)
- `packages/shared` — shared Zod schemas and types
- `packages/wewire` — WeWire API client (server-only)

### Expo

The mobile app uses Expo SDK 54. Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any mobile code.

React is pinned to `19.1.0` via root `overrides`. After `bun install`, `scripts/link-mobile-deps.mjs` junctions `react` / `react-dom` / `react-native` into `apps/mobile/node_modules` so Metro does not hit an invalid-hook / duplicate-React error.

Mobile UI uses NativeWind v5 + `@assistant-ui/react-native` (not the web `@assistant-ui/react` package).

### Architecture rules

Mobile and MCP never call WeWire directly. All money movement goes through `apps/api`.

### Workflow

- Do not start dev or build processes unless explicitly stated or when you have need to verify changes you have made.
- Do not kill dev or build processes that weren't started by you unless explicitly asked to do so.
- We are in a pnpm workspace. I expect you to know to only use pnpm for package management and package executions. You are only allowed to use `npx` when `pnpm dlx` or `pnx` do not work.
- Run `check` and `check-types` on every change made before you commit or push (only push when asked).
- When given tasks, you are to commit as frequently as possible to make sure changes are tracked with low risk of losing access to changes made.
- Remember to keep small/atomic commits with conventional commit syntax.
- When given tasks to work on, do not commit to main unless asked to do so. Execute on a separate branch and open a pull request afterwards. Keep pr description slop to a minimum
- When a given task is too large to execute at once, you're allowed to spin off subagents, break down and hand off tasks to them. Do not dump project context on subagents. Only provide them with the context they need to complete the task you assign them while you maintain top-level context.
- While we work together, we're allowed to explore alternatives to arriving at a solution. That does not permit you to constantly circle about or spiral and end up wasting time. We must work with maximum efficiency.
- TypeScript must be written as TypeScript. **DO NOT** write TypeScript like python. We don't do that here. Eliminate or only use the following if and only if absolutely necessary: Explicit return types, `any`
- Feel free to push back against ideas I want to work on especially if they sound dumb to you. We are a team, not master and slave.
- When working with tech/packages/libraries ensure to work with the latest available knowledge on the version being used or specified. Refer to skills in project directory if available or docs on what's being used if a task becomes too difficult or takes longer than it should.
