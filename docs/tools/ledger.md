# Ledger and approvals

Finora's backend defines reality: balances and every money movement live in Postgres, not on the phone. The app, chat, automations, and MCP all read the same numbers. Everything is `mode: demo` until WeWire rails are live: no real money moves, and WeWire will later replace only the inside of the execute step.

## The ledger

| Table                 | What it holds                                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `ledger_wallets`      | One row per wallet (`w-usd`, `w-ghs`, ...). `balance_minor` has a `>= 0` check, so a payment that would overdraw it fails    |
| `ledger_transactions` | What Activity shows. Unique on (user, `kind`, `source_id`), so the same payroll run, action, or card load can't settle twice |
| `ledger_entries`      | Signed balance changes, one per wallet a transaction touched                                                                 |

`settle()` (`apps/api/src/ledger/ledger.ts`) writes the transaction, the balance updates, the entries, and anything that must change with it (marking a payroll run or action executed) in one database transaction (`db.batch` on neon-http).

On first launch after the ledger shipped, the app copies its own demo balances and history once (`POST /v1/wallets/import`). The copy is refused once anything has settled, so a stale phone can't overwrite the ledger. Accounts that never had the app start from `DEMO_STARTING_WALLETS`.

| Route                                              | Purpose                                                   |
| -------------------------------------------------- | --------------------------------------------------------- |
| `GET /v1/wallets`, `GET /v1/balances`              | Balances (`initialized` is false until the one-time copy) |
| `POST /v1/wallets/import`                          | The one-time copy                                         |
| `POST /v1/wallets/:id/fund`                        | Demo deposit (Fund account)                               |
| `GET /v1/transactions`, `GET /v1/transactions/:id` | Activity                                                  |

## Prepared actions

Payments, conversions, and financial plans are **prepared actions** (`prepared_actions`). Chat tools, the app, automations, and MCP can prepare one; it executes only after the user approves it in the app with their passcode.

1. **Prepare** (`POST /v1/actions`, or the chat tools `prepare_payment`, `prepare_conversion`, `prepare_supplier_payment`, `create_financial_plan`): validates the request, prices it at demo FX rates, picks the funding wallet, runs the policy check, and stores it as `pending_approval`.
2. **Edit** (`PUT /v1/actions/:id`): the payment card lets the user change details before approving; the new details are checked again.
3. **Approve and execute** (`POST /v1/actions/:id/execute`): the app calls this after the passcode. The ledger moves the money and the action becomes `executed` together. An action executes once.
4. **Cancel** (`POST /v1/actions/:id/cancel`).

Payments for an invoice, bill, SMS request, or calendar event carry a `relatedId`; Finora refuses a second payment for the same one (`already_paid`). Cards reload their action on mount, so a reopened chat shows what really happened. The Approvals inbox lists the same actions.

Payroll runs (`docs/tools/payroll.md`) and card loads settle on the same ledger.

## Fees and rates

- Payments: no fee.
- Conversions: 0.4% of the amount, taken before converting.
- Payroll: free. Card loads and top-ups: $1.
- Rates: `DEMO_FX_USD_RATES` in `packages/shared/src/ledger.ts`.

## Automations

After money moves, `afterMoneyMoved` queues the user's balance automations with the wallet's new balance (`apps/api/src/automations/balance-events.ts`). The app no longer reports balances.

## Database

Apply with `pnpm --filter @finora/api db:push`.
