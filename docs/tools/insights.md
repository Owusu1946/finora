# Insights

Read-only tools over the user's own ledger, recurring payments, invoices, payroll, and card purchases (`apps/api/src/insights/`). Amounts are converted to USD at demo FX rates, and balances are demo until WeWire is live.

| Chat tool                     | What it answers                                                        | Card                 |
| ----------------------------- | ---------------------------------------------------------------------- | -------------------- |
| `summarize_spending`          | Money out by category and top recipients, vs the period before         | Spending by category |
| `generate_financial_insights` | In, out, net, and highlights for a period                              | Financial report     |
| `get_treasury_overview`       | Balances, bills due in 30 days, projected balance                      | Treasury             |
| `analyze_cash_flow`           | Balance forecast and its lowest point                                  | Text                 |
| `predict_upcoming_bills`      | Recurring payments, invoices with due dates, the next payroll          | Text                 |
| `detect_duplicate_payments`   | Same recipient, amount, and currency within 48 hours (payroll ignored) | Text                 |
| `list_expenses`               | Recent virtual card purchases                                          | Expenses             |

## How the numbers work

- **Categories:** every ledger transaction stores one (Payroll, Suppliers, Invoices, Bills, Transfers, Payments, Cards, Conversions, Plans, Deposits, Refunds). Older rows get one from what created them.
- **Spending:** money out minus refunds. Conversions are left out, since they move money between the user's own wallets.
- **Periods:** `month` compares month-to-date with the same days last month; `last_month`, `week` (7 days), and `quarter` (90 days) compare with the period just before. A change is reported only at 15% or more and at least $20.
- **Forecast:** today's balance, plus the average daily net of the last 30 days (leaving out conversions, payroll, and bills, which are added on their own dates), minus each known bill on its due date. It's a projection, not a promise.
- **Next payroll:** assumed monthly, the same total as the last paid run.

## Weekly message

Mondays at 08:00 UTC, everyone who moved money in the last 14 days gets "Your week in money" in their Automations chat: changes, possible double payments, low-balance warnings, and bills due. Nothing is posted when the week only has totals.

## App

The Treasury screen reads `GET /v1/insights/treasury`; `GET /v1/insights/report?period=` returns the report. Dictation learns names from saved payees and payroll imports; there is no mock employee roster any more.
