# Finora tools (MCP + API)

Mock-complete tool surface so mobile, MCP, and WeWire wiring can land without redesign.

## Architecture

```
AI agent  →  apps/mcp (tools)  →  apps/api (/v1/*)  →  packages/wewire  →  WeWire
Human app →  apps/api (/v1/*)  ↗
```

- MCP and mobile **never** call WeWire directly.
- Money tools **prepare** only → `pending_approval` → human confirms in Approvals (`POST /v1/approvals/:id/resolve`).

## Tool count

See `TOOL_NAMES` in `packages/shared/src/tools.ts` (~40 tools).

| Group | Tools |
|---|---|
| Health | `ping` |
| Wallets / receive | `get_balances`, `list_wallets`, `list_receive_methods`, `list_virtual_accounts`, `list_crypto_addresses` |
| Contacts | `search_contacts`, `list_contacts`, `save_contact`, `lookup_account` |
| Payments (prepare) | `prepare_payment`, `prepare_momo_disbursement`, `prepare_internal_transfer`, `prepare_conversion` |
| Approvals | `list_approvals`, `get_approval`, `request_approval` |
| Transactions | `list_transactions`, `get_transaction` |
| FX | `list_fx_rates`, `get_fx_rate`, `preview_conversion` |
| Sub-customers | `create_subcustomer`, `list_subcustomers`, `get_subcustomer`, `archive_subcustomer` |
| KYC | `submit_subcustomer_kyc`, `get_subcustomer_kyc_link`, `get_kyc_requirements`, `add_beneficial_owner`, `submit_kyc_for_review` |
| Invoices | `list_invoices`, `get_invoice`, `prepare_invoice_payment` |
| Recurring | `prepare_recurring_payment`, `list_recurring_payments`, `update_recurring_payment` |

## Key files

| Path | Role |
|---|---|
| `packages/shared/src/enums.ts` | Shared Zod enums (status, rails, KYC, etc.) |
| `packages/shared/src/tools.ts` | `TOOL_NAMES` + input schemas |
| `packages/wewire/src/client.ts` | Typed WeWire HTTP methods (all API groups) |
| `apps/api/src/mock/store.ts` | In-memory mock data |
| `apps/api/src/routes/v1.ts` | Mock `/v1/*` routes |
| `apps/mcp/src/tools/catalog.ts` | Tool → API path map |
| `apps/mcp/src/server.ts` | Registers every tool |

## Local try

```bash
# terminal 1
pnpm --filter @finora/api dev

# terminal 2 — point FINORA_API_URL at local API
pnpm --filter @finora/mcp dev
```

Then call MCP tools (e.g. `prepare_payment`, `list_approvals`). Approvals appear as `pending`; resolve only via API human path.
