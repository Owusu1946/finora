# Automations

An automation is a rule: **when** something happens, Finora **reminds** the user or **prepares** an action. It never moves money. Money rules end in the same prepare, approval, and passcode flow as chat.

## Triggers and what sets them off

| Trigger             | Producer                                                                    |
| ------------------- | --------------------------------------------------------------------------- |
| `schedule`          | Cron every minute (`enqueueDueAutomations`), in the rule's timezone         |
| `balance_threshold` | The app reports wallet balance changes (`AutomationBalanceBridge`)          |
| `gmail_invoice`     | Gmail sync, when it stores a new invoice (`enqueueGmailInvoiceEvents`)      |
| `invoice_due`       | Daily scan at 07:00 UTC of unpaid invoices with a due date                  |
| Run now             | `POST /v1/automations/:id/run` or chat; skips trigger, conditions, cooldown |

Every event goes through the `finora-automation-evaluation` queue. The runner checks the trigger, conditions, and cooldown, then logs the run in `automation_execution_logs`.

## Where results go

Each user has one **Automations chat** (`automations_<userId>`). The runner posts there:

- **Reminders** (`notify_chat`) arrive as a message.
- **Money rules** (`prepare_*`) arrive as a message plus an `automation_ready` card. **Prepare it** sends a prompt to Finora, which prepares the action with the normal chat tools, so the approval card and passcode apply.

`automation_ready` is a display-only tool part. It is kept in chat history but stripped before the model sees the conversation (`withoutDisplayOnlyParts`).

The app polls `/v1/automations/activity` and shows a local notification for each run. Tapping it opens the Automations chat.

## Chat tools

| Tool                | What it does                                                     |
| ------------------- | ---------------------------------------------------------------- |
| `list_automations`  | Lists rules with a plain-English description and last run        |
| `create_automation` | Drafts a rule; the user taps **Turn on** in the card to save it  |
| `manage_automation` | Pause, resume, or run now directly; delete asks for confirmation |

The app sends its timezone in `X-Timezone`, and the prompt tells the model the user's local date and time, so "every Friday at 9" means 09:00 where the user is.

## Testing locally

`wrangler dev` runs the queue locally, so **Run now** works end to end. Cron doesn't fire in `wrangler dev`; trigger it with `curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"` after starting with `--test-scheduled`, or deploy.
