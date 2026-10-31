# Payroll

Payroll runs in chat: get the list in, fix it, prepare it, approve with the passcode, pay. AI prepares; only the user's passcode pays.

## Getting payroll in

| Input                           | Path                                                                                     |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| CSV, TSV, TXT, JSON, XLSX, DOCX | Upload, then `inspect_payroll_attachment` parses columns directly                        |
| PDF                             | Text first; if no usable rows come out (lost columns, scans), the model reads the PDF    |
| Photo or screenshot             | The model reads it, with a schema-checked reply (`extractPayrollWithModel`)              |
| Typed or spoken                 | `draft_payroll`: the model lists each person exactly as given, nulls for anything unsaid |
| "Same as last month"            | `list_payroll_imports`, then `prepare_payroll` with that import and the new period       |

All paths save a payroll import (`savePayrollImport`) with the same row checks: name, amount, currency, and destination are required. The chat shows one review card. Flagged rows have a **Fix** button that opens the row editor; when nothing is blocked, **Prepare payroll** asks Finora to prepare it.

## Paying

1. `prepare_payroll` (everyone or chosen rows) or `prepare_employee_payment` (one person, optionally a different amount) creates a **payroll run** in `payroll_runs` with one `payroll_run_items` row per employee, status `pending_approval`. One currency per run.
2. The run card shows each employee with a masked destination, and **Pay from** for the user's accounts. Payroll is free; a wallet in another currency is converted at the demo FX rates.
3. **Approve and pay** asks for the passcode, then calls `POST /v1/payroll/runs/:id/execute` with the chosen wallet. Finora takes the converted total from the [ledger](./ledger.md) and marks every payout sent in one step, so a retry can't pay twice and nothing is charged unless the run is paid.
4. The card shows each payout as sent, the run appears once in Activity, and a summary posts in chat. The Payroll screen lists paid runs under **Paid**.

Runs are `mode: demo` until WeWire payouts are live: nobody is really paid, and the card says so.

## Database

`payroll_runs` and `payroll_run_items` are new, and `payroll_imports.attachment_id` is nullable (typed payroll has no file). Apply with `pnpm --filter @finora/api db:push`.
