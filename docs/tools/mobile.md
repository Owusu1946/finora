# Mobile chat tools (Expo)

Vision: the Expo app is **ChatGPT for money** — a client of the Finora platform, not the platform itself.

Today the in-app model is a **local mock adapter** ([`apps/mobile/lib/chat-adapter.ts`](../../apps/mobile/lib/chat-adapter.ts)) plus `makeAssistantToolUI` renderers. It does **not** yet call live MCP/`/v1` for every registry tool.

---

## Tools the chat UI actually handles

| toolName | UI | Trigger examples (mock) |
|---|---|---|
| `get_balances` | Balances card | “What’s my balance?” |
| `list_receive_methods` | Receive card | “How do I receive money?” |
| `prepare_payment` | Payment confirm + passcode | “Send 50 GHS to …” |
| `resolve_send` | Contact picker → amount → confirm | “Send to Ama” (disambiguate) |
| `prepare_conversion` | FX card + passcode | “Convert 100 USD to GHS” |
| `list_invoices` | Invoice list | “Show my invoices” |
| `prepare_recurring` | Recurring card | (legacy path) |
| `schedule_payment_wizard` | Multi-step schedule UI | “Set up rent monthly” |
| `create_financial_plan` | Plan card (approve all) | “Pay everything due today” |

Register UIs in [`apps/mobile/app/_layout.tsx`](../../apps/mobile/app/_layout.tsx).

---

## Related product surfaces (not chat tool calls)

| Surface | Role |
|---|---|
| **Approvals inbox** | Human confirms MCP- or chat-prepared payments **and** multi-item plans |
| **Activity / transaction detail** | Timeline after settle |
| **Integrations** | Connect Gmail (maps to `connect_gmail` idea) |
| **Contacts / Recurring / Invoices screens** | CRUD UIs for platform capabilities |

`mark_notification_read` belongs here as an **app action** when a notifications UI exists — not as something the mock chat agent calls.

---

## Mapping to the registry

Prefer aligning chat `toolName`s with registry snake_case (`prepare_payment`, `create_financial_plan`).  
Exceptions today: `resolve_send`, `schedule_payment_wizard` — mobile UX composites that orchestrate lower-level platform ideas (`resolve_recipient`, `prepare_recurring_payment`).

When wiring live backend: chat/MCP should call Finora API, never WeWire.
