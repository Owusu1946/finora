# MCP tools (external AI agents)

Aligned with Vision §2 / §6: MCP is how ChatGPT, Claude Desktop, Cursor, etc. talk to Finora. Agents **prepare**; humans **approve** in the Expo Approvals inbox.

**Registered list:** `MCP_TOOL_NAMES` in [`packages/shared/src/registry.ts`](../../packages/shared/src/registry.ts)  
**HTTP map:** [`apps/mcp/src/tools/catalog.ts`](../../apps/mcp/src/tools/catalog.ts)  
**Server:** [`apps/mcp/src/server.ts`](../../apps/mcp/src/server.ts) (registers **only** this set)

---

## What agents get (26 tools)

Gmail read tools: `get_gmail_status`, `search_gmail_messages`, `get_gmail_message`, and `find_gmail_invoices`. They use bounded structured searches, keep OAuth tokens encrypted on the API, fetch full text only for an explicitly selected message, and never download attachments or mutate the mailbox. Email content cannot authorize or trigger financial actions.

| Tool                           | Purpose         | Typical agent use                         |
| ------------------------------ | --------------- | ----------------------------------------- |
| `ping`                         | Health          | Connectivity check                        |
| `get_current_user`             | Profile         | Confirm the authenticated Finora identity |
| `get_balances`                 | Balances        | “How much USD do I have?”                 |
| `list_wallets`                 | Wallets         | Pick a funding source                     |
| `search_recipient`             | Find payee      | Saved contacts and suppliers (masked)     |
| `prepare_payment`              | Prepare payout  | Pass `contactId` to pay a saved contact   |
| `prepare_conversion`           | Prepare FX      | Between two of the user's wallets         |
| `prepare_invoice_payment`      | Pay a bill      | To the saved supplier matching the vendor |
| `prepare_supplier_payment`     | Pay supplier    | A saved supplier                          |
| `prepare_payroll`              | Payroll run     | From an imported payroll                  |
| `create_financial_plan`        | Multi-item plan | One approval for listed items             |
| `prepare_daily_plan`           | Today's plan    | “Handle everything due today”             |
| `request_approval`             | Check inbox     | Confirms it's waiting for the user        |
| `get_payment_status`           | Poll            | `act_…`, payroll run id, or `tx_…`        |
| `list_transactions`            | History         | Ledger Activity (destinations masked)     |
| `list_invoices`                | Bills           | Gmail-sourced invoices                    |
| `list_notifications`           | Alerts          | Preparations waiting for approval         |
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
1. search_recipient { query: "Ama" }                  → contactId
2. evaluate_policy { action: "prepare_payment", amount: { amount: 500, currency: "GHS" } }
3. prepare_payment { contactId, amount: { amount: 500, currency: "GHS" } }  → preparationId (act_…)
4. ── the user gets a notification, opens Approvals in the Finora app, enters their passcode ──
5. get_payment_status { preparationId }               → executed, with the ledger transaction
```

Everything due today:

```text
prepare_daily_plan {}
  → one plan: payments waiting, payroll, invoices due, plus any conversion a wallet needs
  → the user taps Approve all in the app; each item is paid in turn and reported
```

## How it maps to the API

Prepare tools call `/v1/agent/*` (`apps/api/src/routes/agent.ts`), which prepares the same actions chat does, marked `source: mcp`. They wait in the Approvals inbox and the app notifies the user while it's open. No agent route executes anything. Balances, wallets, and transactions read the ledger (`/v1/wallets`, `/v1/transactions`); discovery tools (`list_supported_*`) still return static demo data.
