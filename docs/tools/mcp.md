# MCP tools (external AI agents)

Aligned with Vision §2 / §6: MCP is how ChatGPT, Claude Desktop, Cursor, etc. talk to Finora. Agents **prepare**; humans **approve** in the Expo Approvals inbox.

**Registered list:** `MCP_TOOL_NAMES` in [`packages/shared/src/registry.ts`](../../packages/shared/src/registry.ts)  
**HTTP map:** [`apps/mcp/src/tools/catalog.ts`](../../apps/mcp/src/tools/catalog.ts)  
**Server:** [`apps/mcp/src/server.ts`](../../apps/mcp/src/server.ts) (registers **only** this set)

---

## What agents get (~23 tools)

| Tool                           | Purpose         | Typical agent use                         |
| ------------------------------ | --------------- | ----------------------------------------- |
| `ping`                         | Health          | Connectivity check                        |
| `get_current_user`             | Profile         | Confirm the authenticated Finora identity |
| `get_balances`                 | Balances        | “How much USD do I have?”                 |
| `list_wallets`                 | Wallets         | Pick a funding source                     |
| `search_recipient`             | Find payee      | “Pay Ama…”                                |
| `prepare_payment`              | Prepare payout  | Creates pending approval — **no settle**  |
| `prepare_conversion`           | Prepare FX      | Same approval path                        |
| `prepare_invoice_payment`      | Pay a bill      | After `list_invoices`                     |
| `prepare_supplier_payment`     | Pay supplier    | Business                                  |
| `prepare_payroll`              | Payroll run     | Business — still needs human PIN          |
| `create_financial_plan`        | Multi-item plan | “Pay everything due today”                |
| `begin_transaction`            | Open batch      | Group related prepares                    |
| `commit_transaction`           | Finish batch    | → request human approval                  |
| `rollback_transaction`         | Abort batch     | Cancel preparations                       |
| `request_approval`             | Notify human    | Push Approvals inbox / push notif         |
| `get_payment_status`           | Poll            | After prepare / execute                   |
| `list_transactions`            | History         | Activity queries                          |
| `list_invoices`                | Bills           | Gmail-sourced invoices                    |
| `list_notifications`           | Alerts          | Read-only (“3 pending approvals”)         |
| `evaluate_policy`              | Policy check    | Before prepare                            |
| `list_supported_payment_rails` | Discovery       | What rails exist                          |
| `list_supported_countries`     | Discovery       | Corridors                                 |
| `list_supported_assets`        | Discovery       | USD/GHS/USDT/…                            |
| `get_recent_context`           | Context         | Resolve “her” / last wallet               |

---

## What agents do **not** get

Even if the name exists in the full registry:

- Any `execute_approved_*` / “send money” settle
- `approve_transaction` / `verify_pin` / biometrics
- Credential/session lifecycle (`create_user`, `login_user`, `logout_user`, `refresh_session`, `delete_account`)
- Theme / language / conversation CRUD
- Notification **mutations** (`mark_notification_read`, `delete_notification`)
- KYC submit / device revoke
- Webhook admin, policy CRUD (agents may only `evaluate_policy`)

Those stay on **platform** and/or **mobile** so the human remains in the loop (Vision).

---

## Example agent flow

```text
1. list_supported_payment_rails     (optional discovery)
2. search_recipient { query: "Ama" }
3. evaluate_policy { action: "prepare_payment", amount: 500 }
4. prepare_payment { … }
5. request_approval { preparationId }
6. ── human opens Finora app → Approvals → PIN ──
7. get_payment_status { preparationId }   (or list_notifications)
```

Multi-item:

```text
create_financial_plan { intent: "Pay everything due today" }
  → request_approval
  → human Approve all + PIN
  → execute_approved_financial_plan (platform/mobile only)
```
