# Finora tools — developer guide

Source of truth for tool **names / surfaces / risk**: [`packages/shared/src/registry.ts`](../../packages/shared/src/registry.ts).  
Product architecture: [`.agents/FINORA_VISION.md`](../../.agents/FINORA_VISION.md).

| Doc                                          | What it covers                                          |
| -------------------------------------------- | ------------------------------------------------------- |
| [This page](./README.md)                     | Tools vs APIs (read this first)                         |
| [catalog.md](./catalog.md)                   | Full registry by category — what each capability is for |
| [mcp.md](./mcp.md)                           | What **external AI agents** actually get via MCP        |
| [mobile.md](./mobile.md)                     | What the **Expo chat** mock adapter uses today          |
| [WeWire coverage](../wewire-api-coverage.md) | WeWire endpoint priorities and live-integration gaps    |

---

## Are we mixing APIs with tools?

**Short answer:** the registry is a **capability catalog**, not “every row is an MCP tool an agent calls.”

```text
┌─────────────────────────────────────────────────────────────┐
│  TOOL_REGISTRY (shared)                                      │
│  Named capabilities: prepare_payment, mark_notification_read │
│  Each has surface(s) + risk                                  │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   platform              mcp                 mobile
   (rich HTTP API)   (curated ~23)      (local / in-app)
        │                   │                   │
        ▼                   ▼                   ▼
   apps/api /v1/*      apps/mcp            Expo UI / PIN /
   implements most     registers only      biometrics / chat
                       MCP_TOOL_NAMES      tool UIs
```

| Layer                | What it is                              | Example                                                                 |
| -------------------- | --------------------------------------- | ----------------------------------------------------------------------- |
| **Registry entry**   | Contract name + who may use it          | `mark_notification_read`                                                |
| **HTTP API**         | How the platform implements it          | `PATCH /v1/notifications/:id/read` (when wired)                         |
| **MCP tool**         | Subset exposed to ChatGPT/Claude/Cursor | **Not** `mark_notification_read` — agents only get `list_notifications` |
| **Mobile UI action** | Human taps “mark read” in the app       | App calls platform API (or local storage today)                         |

So: **not every registry name is an agent tool.** Many are platform/mobile operations that _back_ the product (Vision: Expo and MCP are both clients of the same Finora backend).

### Example: `mark_notification_read`

| Question                   | Answer                                                                                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Is this an MCP tool?       | **No.** Surfaces: `platform`, `mobile` only.                                                                                                                                        |
| Will ChatGPT call it?      | **No.** External agents can `list_notifications` (read). Mutating inbox state is a **human / app** concern.                                                                         |
| How is it used?            | User opens notifications in the app → taps a row → app marks it read via Finora API. In-app Gemini _could_ call it later if we expose it on the mobile runtime; still never on MCP. |
| Why is it in the registry? | So product, API, and mobile stay aligned on **one name** for “mark notification read,” same as Vision’s shared backend.                                                             |

---

## Three surfaces (Vision §6)

| Surface        | Who                                      | Risk allowed                              | Money rule                                              |
| -------------- | ---------------------------------------- | ----------------------------------------- | ------------------------------------------------------- |
| **`mcp`**      | External AI (ChatGPT, Claude, Cursor, …) | `read` + `prepare` only                   | May **prepare** / request approval. Never settle rails. |
| **`platform`** | Finora API (`apps/api`)                  | `read` / `prepare` / `execute`            | `execute_*` only **after** Approvals + PIN              |
| **`mobile`**   | Expo app / local runtime                 | Also `local` (theme, threads, biometrics) | Human confirms in Approvals inbox                       |

Canonical ids are **snake_case** (`prepare_payment`). camelCase (`preparePayment`) is a product alias via `TOOL_CAMEL_ALIASES`.

---

## Money path (always)

```text
prepare_*  or  create_financial_plan  or  begin_transaction
        →  evaluate_policy (optional)
        →  request_approval / commit_transaction
        →  human Approvals inbox + PIN / biometrics
        →  execute_approved_*
        →  audit → WeWire
```

Mobile and MCP **never** call WeWire directly.

---

## Implementation status (be honest with contributors)

| Area                                               | Status                                                                 |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| Registry + Zod schemas for MCP                     | In repo                                                                |
| MCP server registers curated tools → `/v1/*` mocks | In repo                                                                |
| API mock routes for many capabilities              | In repo (stubs)                                                        |
| Mobile Approvals + plan UI                         | In repo (local mock storage)                                           |
| Live WeWire behind every platform tool             | **Not** yet — stubs / mocks                                            |
| Every registry row called from mobile chat         | **No** — chat uses a small mock adapter set ([mobile.md](./mobile.md)) |

If a tool is `platform` only and you don’t see an MCP catalog entry or a mobile `*ToolUI`, it is still a **planned platform capability**, not “dead code” and not “an agent tool.”

---

## Run the tool surfaces locally

From the repository root:

| Command           | Surface                                    | Expected result                                                               |
| ----------------- | ------------------------------------------ | ----------------------------------------------------------------------------- |
| `pnpm dev:api`    | Platform HTTP API                          | Wrangler listens on `http://127.0.0.1:8787`.                                  |
| `pnpm dev:mcp`    | Curated external-agent tools               | Wrangler listens on `http://127.0.0.1:8789` and calls the API on port `8787`. |
| `pnpm dev:mobile` | Human app and mobile-local tools           | Metro normally listens on port `8081`.                                        |
| `pnpm dev`        | All application surfaces plus the web site | Turbo keeps API, MCP, mobile, and web running together.                       |

For a physical phone, also run `pnpm dev:lan`. It proxies the loopback API from port `8787` to
the computer's LAN interfaces on port `8788`. It does not start the API itself.

---

## Where to change things

| Change                    | Edit                                                                |
| ------------------------- | ------------------------------------------------------------------- |
| Add / rename a capability | `packages/shared/src/registry.ts` (+ schemas in `tools.ts` if MCP)  |
| Expose to external agents | Give it `mcp` surface + `read`/`prepare` risk; add MCP catalog path |
| HTTP behavior             | `apps/api/src/routes/v1.ts` (+ WeWire client later)                 |
| In-app chat demo          | `apps/mobile/lib/chat-adapter.ts` + `*ToolUI.tsx`                   |
