# Finora tools (MCP + API)

Three-surface tool registry: rich **platform** operations, curated **MCP** orchestration tools, and **mobile**-local helpers.

## Surfaces

| Surface    | Who calls it                  | What they see                                                       |
| ---------- | ----------------------------- | ------------------------------------------------------------------- |
| `mobile`   | In-app Gemini / local runtime | PIN, biometrics, theme, threads, execute after approval             |
| `platform` | Finora API                    | Full operation set (prepare + execute + policy CRUD + webhooks + …) |
| `mcp`      | External AI agents            | **~20 high-level tools** only — read + prepare — never settle rails |

Canonical ids are **snake_case** (`prepare_payment`). camelCase (`preparePayment`) is the product alias via `TOOL_CAMEL_ALIASES`.

Source of truth: [`src/registry.ts`](src/registry.ts).

**Developer docs (tools vs APIs, full catalog, MCP subset):** [`docs/tools/`](../../docs/tools/README.md).

## Architecture

```
External AI  →  apps/mcp (curated MCP_TOOL_NAMES)  →  apps/api (/v1/*)  →  WeWire
Human app    →  apps/api (rich PLATFORM_TOOL_NAMES) ↗
                 ↑
            Approvals + PIN → execute_approved_* (platform/mobile only)
```

- MCP and mobile **never** call WeWire directly.
- Prefer `create_financial_plan` / `begin_transaction` for multi-step work, then `request_approval`.
- Settlement is always `execute_approved_*` after human approval — never a direct MCP execute.

## Approve-before-execute

```
create_financial_plan | prepare_* | begin_transaction
        → evaluate_policy
        → request_approval / commit_transaction
        → Approvals inbox + PIN (mobile)
        → execute_approved_* (platform)
        → Audit → WeWire
```

## Curated MCP tools

Agents should use this small set (internally mapped to rich `/v1` routes):

- `search_recipient`, `get_balances`, `list_wallets`, `list_transactions`, `list_invoices`, `list_notifications`
- `prepare_payment`, `prepare_conversion`, `prepare_invoice_payment`, `prepare_supplier_payment`, `prepare_payroll`
- `create_financial_plan`, `begin_transaction`, `commit_transaction`, `rollback_transaction`
- `request_approval`, `get_payment_status`, `evaluate_policy`
- `list_supported_payment_rails`, `list_supported_countries`, `list_supported_assets`
- `get_recent_context`, `ping`

## Key exports

| Export                               | Role                             |
| ------------------------------------ | -------------------------------- |
| `TOOL_REGISTRY`                      | Full catalog with surface + risk |
| `MCP_TOOL_NAMES`                     | Curated MCP registration list    |
| `PLATFORM_TOOL_NAMES` / `TOOL_NAMES` | Rich API tools                   |
| `MOBILE_TOOL_NAMES`                  | Local / in-app tools             |
| `TOOL_INPUT_SCHEMAS`                 | Zod inputs for MCP tools         |
| `isMcpSafeTool`                      | Runtime guard                    |

## Key files

| Path                              | Role                            |
| --------------------------------- | ------------------------------- |
| `packages/shared/src/registry.ts` | Three-surface registry          |
| `packages/shared/src/tools.ts`    | Zod input schemas               |
| `apps/api/src/routes/v1.ts`       | Mock `/v1/*` routes             |
| `apps/mcp/src/tools/catalog.ts`   | MCP → API path map              |
| `apps/mcp/src/server.ts`          | Registers `MCP_TOOL_NAMES` only |

## Local try

```bash
pnpm --filter @finora/api dev
pnpm --filter @finora/mcp dev
```
