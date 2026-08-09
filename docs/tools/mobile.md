# Mobile chat tools (Expo)

Vision: the Expo app is **ChatGPT for money** — a client of the Finora platform, not the platform itself.

Chat uses the on-device mock adapter ([`chat-adapter.ts`](../../apps/mobile/lib/chat-adapter.ts)) via `useLocalRuntime` — no LLM / Gemini. Assistant text renders as markdown ([`markdown-text.tsx`](../../apps/mobile/components/assistant-ui/markdown-text.tsx)). Tool UIs stay on-device (`makeAssistantToolUI`).

### Scan QR → pay

Entry: chat header QR icon, composer QR button, or `/scan` (hidden drawer screen).

| Payload         | Example                         | Flow                                                   |
| --------------- | ------------------------------- | ------------------------------------------------------ |
| MoMo receive    | `finora:momo:ghs:0550123456`    | Scan → amount → `prepare_payment`                      |
| VA receive      | `finora:va:usd:GB82…`           | Scan → amount → `prepare_payment`                      |
| Crypto          | `TXyz…` / `0x…`                 | Scan → amount → `prepare_payment`                      |
| Payment request | `https://pay.finora.app/r/{id}` | Lookup amount from in-app registry → `prepare_payment` |

Receive / payment-request cards encode real QRs ([`MockQrCode.tsx`](../../apps/mobile/components/chat/MockQrCode.tsx)). Paste fallback on the scan screen supports simulator / single-device demos.

**Payment links open chat:** `https://pay.finora.app/r/{id}` and `finora://pay/r/{id}` route to [`app/pay/r/[id].tsx`](../../apps/mobile/app/pay/r/[id].tsx), which starts `prepare_payment` in chat (amount from the in-app registry when the request was created on this device). Share includes an Expo/`finora://` app link so Expo Go can open the flow.

---

## Tools the chat UI actually handles

| toolName                    | UI                                                  | Trigger examples (mock)                              |
| --------------------------- | --------------------------------------------------- | ---------------------------------------------------- |
| `get_balances`              | Balances card                                       | “What’s my balance?”                                 |
| `fund_account`              | Add-money wizard (bank / MoMo / crypto / MoMo pull) | “Fund my account”, “Deposit”, “Top up”, “Add money”  |
| `list_receive_methods`      | Receive card (QR, share, copy)                      | “How do I receive?”, “Payment details”               |
| `create_payment_request`    | Ask-to-pay wizard → link + QR                       | “Create a payment link”, “Request 50 GHS”            |
| `generate_payment_link`     | Same UX as payment request (registry alias)         | (tool name from platform/mobile)                     |
| `prepare_payment`           | International send wizard → confirm + passcode      | “Send €200 to Germany”, “Send 50 GHS to …”, scan QR  |
| `resolve_send`              | Contact picker → international send wizard          | “Send to Ama” (disambiguate)                         |
| `prepare_internal_transfer` | Finora wallet confirmation + passcode               | “Send 50 cedis to @okenneth”                         |
| `prepare_conversion`        | FX card + passcode                                  | “Convert 100 USD to GHS”                             |
| `list_invoices`             | Invoice list                                        | “Show my invoices”                                   |
| `list_calendar_dues`        | Calendar money events                               | “What’s due on my calendar this week?”               |
| `list_sms_requests`         | SMS payment requests                                | “Show payment requests from my SMS inbox”            |
| `prepare_recurring`         | Recurring card                                      | (legacy path)                                        |
| `schedule_payment_wizard`   | Multi-step schedule UI                              | “Set up rent monthly”                                |
| `create_financial_plan`     | Plan card (approve all)                             | “Pay everything due today”                           |
| `create_virtual_card`       | Issue wizard → passcode → card face                 | “Create a virtual card for Netflix with a $50 limit” |
| `list_virtual_cards`        | Stack of compact card faces                         | “Show my cards”                                      |
| `get_virtual_card`          | Detail + manage (reveal / freeze / limit)           | “Freeze my Netflix card”                             |

### Virtual cards

Mock-only for now (no WeWire card rails). Shared store: [`virtual-cards-storage.ts`](../../apps/mobile/lib/virtual-cards-storage.ts).

- **Chat:** create / list / manage ToolUIs under [`components/chat/`](../../apps/mobile/components/chat/)
- **Screens:** drawer Money → Cards ([`cards.tsx`](<../../apps/mobile/app/(app)/cards.tsx>)), detail ([`card/[id].tsx`](<../../apps/mobile/app/(app)/card/[id].tsx>))
- **Reveal** full PAN / expiry / CVV always requires passcode (30s timeout)

Demo: “Create a virtual card for Netflix with a $50 limit” → approve → open Cards → reveal → freeze.

### International send wizard

[`SendMoneyWizard.tsx`](../../apps/mobile/components/chat/SendMoneyWizard.tsx) powers `prepare_payment` and (after contact pick) `resolve_send`.

Steps (seed-skips any field already provided by the adapter):

1. **Country** — curated corridors from [`send-corridors.ts`](../../apps/mobile/lib/send-corridors.ts) (+ crypto)
2. **Rail** — `MOMO` / `LOCAL_BANK` / `ACH` / `WIRE` / `FPS` / `CHAPS` / `SEPA` / `SWIFT` / `CRYPTO`
3. **Destination** — rail-specific fields (IBAN, sort code, routing number, MoMo network, …)
4. **Amount + funding wallet** — payout currency vs funding currency
5. **Purpose** — Finora purpose codes (`GOODS`, `SERVICES`, …) for compliance
6. **FX quote** — only when funding currency ≠ payout currency (mock rate)
7. **Confirm** — [`PaymentConfirmationCard`](../../apps/mobile/components/chat/PaymentConfirmationCard.tsx) + passcode → mock `WW-*` settle

Adapter seeding ([`chat-adapter.ts`](../../apps/mobile/lib/chat-adapter.ts)): country aliases (“Germany”), IBAN country prefix, SEPA/FPS/ACH/SWIFT keywords, MoMo phones. Platform mock catalog: `GET /v1/capabilities/countries` (+ rails per country). Live WeWire beneficiary / `initiate-payout` is not wired yet.

### Finora Tags

A Finora Tag identifies a verified **Finora account**, not an address-book contact. `@tag` is resolved through the platform tag directory and prepares `prepare_internal_transfer` between WeWire sub-customers. Contacts remain external MoMo, bank, or crypto destinations and do not receive tags.

Composer autocomplete never searches the global user directory on short prefixes. `@` / 1–2 characters only filter **recent Finora recipients** from the user’s own graph. At 3+ characters, an **exact** platform tag match may also appear. Full tags still resolve via exact lookup when the message is sent.

### Fund account wizard

[`FundAccountWizard.tsx`](../../apps/mobile/components/chat/FundAccountWizard.tsx) powers `fund_account` for inbound money (WeWire-shaped: VA push, MoMo push, MoMo pull, crypto).

Natural prompts: “add money”, “deposit”, “fund”, “top up”, “charge my momo”.

Steps:

1. **Source** — Bank transfer / Mobile money / Charge my MoMo / Crypto
2. **Currency** (bank only) — USD / EUR / GBP virtual accounts
3. **Details** — QR + copyable fields, or MoMo pull amount + phone
4. **Waiting** — mock inbound credit (~2s)
5. **Credited** — Activity `received` PAYIN via [`recordReceivedFunding`](../../apps/mobile/lib/transactions-storage.ts)

Catalog: [`funding-methods.ts`](../../apps/mobile/lib/funding-methods.ts) (shared with `list_receive_methods` + wallets deposit details).

Register UIs in [`apps/mobile/app/_layout.tsx`](../../apps/mobile/app/_layout.tsx).

---

## Related product surfaces (not chat tool calls)

| Surface                                     | Role                                                                   |
| ------------------------------------------- | ---------------------------------------------------------------------- |
| **Scan to pay**                             | Camera / paste QR → amount if needed → chat `prepare_payment`          |
| **Approvals inbox**                         | Human confirms MCP- or chat-prepared payments **and** multi-item plans |
| **Activity / transaction detail**           | Timeline after settle                                                  |
| **Integrations**                            | Connect Gmail, Google Calendar, SMS inbox (mock)                       |
| **Contacts / Recurring / Invoices screens** | CRUD UIs for platform capabilities                                     |
| **Cards**                                   | Virtual card list + detail (mock issue / freeze / reveal)              |

`mark_notification_read` belongs here as an **app action** when a notifications UI exists — not as something the mock chat agent calls.

---

## Mapping to the registry

Prefer aligning chat `toolName`s with registry snake_case (`prepare_payment`, `create_financial_plan`).  
Exceptions today: `resolve_send`, `schedule_payment_wizard` — mobile UX composites that orchestrate lower-level platform ideas (`resolve_recipient`, `prepare_recurring_payment`).

When wiring live backend: chat/MCP should call Finora API, never WeWire.
