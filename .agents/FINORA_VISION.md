# Finora — Product & Technical Overview

> **Finora gives AI agents the ability to safely understand, manage, and transact with money.** We build the intelligence, financial memory, orchestration, permissions, and user experience; WeWire provides the underlying financial rails. The Finora app is where users control their financial life, while the MCP server allows external AI agents to use the same financial capabilities.

---

## 1. What is Finora?

**Finora is a financial operating system for AI agents.**

The core idea is simple:

> **AI can think, but AI cannot safely move money. Finora gives AI agents a secure financial execution layer.**

Finora combines three things:

1. **A consumer/business financial app** built with React Native/Expo.
2. **A financial AI agent** that users interact with through a ChatGPT-style interface.
3. **An MCP server** that allows external AI agents such as ChatGPT, Claude, Cursor, and other agentic applications to securely access Finora's financial capabilities.

WeWire provides the underlying financial rails.

Finora provides the **AI, orchestration, memory, permissions, approvals, and experience.**

---

## 2. The Big Picture

Think about Finora as this:

```text
                         AI WORLD
                            │
             ┌──────────────┼──────────────┐
             │              │              │
          ChatGPT         Claude         Cursor
             │              │              │
             └──────────────┼──────────────┘
                            │
                         MCP
                            │
                     ┌──────▼──────┐
                     │   FINORA    │
                     │             │
                     │ AI Agent    │
                     │ Memory      │
                     │ Policies    │
                     │ Approvals   │
                     │ Orchestrator│
                     └──────┬──────┘
                            │
                       Finora API
                            │
                     ┌──────▼──────┐
                     │   WeWire    │
                     │   Rails     │
                     └─────────────┘
```

And then there is the Finora mobile app:

```text
                    Finora Mobile App
                           │
                     Chat Interface
                           │
 Finora Backend
      │
                ┌──────────┴──────────┐
                │                     │
             AI Agent              WeWire
                │                     │
             Memory                Money
             Tools                 Wallets
             Policies              Transfers
             Automations            FX
             Insights               Cards
```

The important distinction is:

**The mobile app is a client.**

**The MCP server is the platform.**

| Component             | Role                                         |
| --------------------- | -------------------------------------------- |
| **Finora Backend**    | The core product (`apps/api`, Hono on CF Workers) |
| **Finora MCP Server** | Interface for external AI agents (`apps/mcp`) |
| **Expo Mobile App**   | Interface for humans (`apps/mobile`)         |
| **WhatsApp / Slack / …** | Future interfaces                         |
| **Web dashboard**     | Future interface                             |

They all use the same APIs, policies, and financial accounts.

---

## 3. Why are we building this?

Traditional fintech applications make users manually operate financial systems.

For example:

> Open banking app → find beneficiary → enter amount → select account → confirm → authenticate → send.

Finora changes that.

A user can simply say:

> "Send Ama 500 cedis."

Or:

> "Pay all my suppliers that are due today."

Or:

> "Keep my operating balance above GHS 10,000."

Or:

> "Find the cheapest way to send 1,000 USDT to Nigeria."

The AI understands the request, gathers the necessary information, uses Finora's tools, prepares the financial operation, and asks the user for approval when required.

---

## 4. Finora is NOT just an AI chatbot

This is extremely important.

We are **not building ChatGPT with a banking API attached.**

The real product is the financial infrastructure around the AI.

The AI is the interface.

Finora provides:

* Financial accounts
* Wallets
* Fiat
* Stablecoins
* Transfers
* Mobile Money
* Bank payments
* FX
* Virtual accounts
* Cards
* Beneficiaries
* Suppliers
* Invoices
* Payroll
* Automations
* Financial memory
* Financial intelligence
* Approval policies
* Audit trails
* MCP

---

## 5. Personal and Business accounts

During onboarding, the user chooses:

### Personal

Finora becomes their personal financial assistant.

They can:

* Send money
* Receive money
* Manage wallets
* Send crypto
* Receive crypto
* Convert currencies
* View transactions
* Create virtual accounts
* Manage cards
* Track spending
* Set savings goals
* Automate payments
* Connect Gmail
* Ask financial questions
* Receive financial insights

### Business

Finora becomes an AI financial operator for the business.

It can manage:

* Business wallets
* Virtual accounts
* Suppliers
* Beneficiaries
* Invoices
* Payroll
* Recurring payments
* Treasury
* FX
* Business expenses
* Employee payments
* Financial reporting
* Automations
* Approval policies

There is **no account switcher in the chat UI**.

The account type is selected during onboarding.

If someone wants another account type later, they create another account/profile rather than constantly switching the context of the same conversation.

---

## 6. The Finora chat

The primary interface is deliberately familiar.

Think:

**ChatGPT + financial operating system.**

The user opens Finora and sees:

> How can I help you today?

They can type naturally.

Examples:

> What's my balance?

> Send Ama GHS 500.

> How much did I spend this month?

> Pay my electricity bill.

> Convert 2,000 USDT to GHS.

> Create a virtual card for Netflix.

> Pay all invoices due this week.

> Run payroll.

> Help me save GHS 5,000 a month.

---

## 7. The AI doesn't directly move money

This is one of our most important architectural principles.

The model **never becomes the financial authority.**

The model can:

* understand
* reason
* select tools
* build plans
* ask questions
* explain results

But the backend controls:

* balances
* permissions
* transaction limits
* policies
* recipient validation
* approval requirements
* execution

The flow is:

```text
User
 ↓
AI
 ↓
Tool call
 ↓
Finora Backend
 ↓
Validation / Policy
 ↓
WeWire
 ↓
Approval if required
 ↓
Execution
```

This means even if the model makes a mistake, it cannot simply bypass the financial controls.

**Canonical money-moving pattern:** `prepare_*` → human approval (PIN / biometrics) → `execute_approved_*`. The AI never executes settlement directly.

---

## 8. Tool calling

The AI has access to Finora's tools through MCP (external agents) and through the mobile/platform surfaces (in-app agent).

For example:

```text
get_balances()
resolve_recipient()
prepare_payment()
estimate_fees()
get_fx_rate()
prepare_conversion()
list_invoices()
prepare_invoice_payment()
prepare_payroll()
create_virtual_account()
create_virtual_card()
```

The model chooses which tools to use based on the user's request.

For example:

> "Send Ama 500."

The agent might do:

```text
resolve_recipient()
        ↓
check balance
        ↓
prepare_payment()
        ↓
approval
        ↓
execute_approved_payment()
```

The user doesn't need to know any of that.

Tool docs for engineers: [`docs/tools/`](../docs/tools/README.md). Capability registry: [`packages/shared/src/registry.ts`](../packages/shared/src/registry.ts).

---

## 9. We don't expose 150+ low-level tools blindly

Internally, we can have a huge toolset.

But for the model, we should eventually expose **high-level financial capabilities** where possible.

For example:

```text
prepare_payment()
```

can internally handle:

* recipient resolution
* account validation
* balance checking
* fee calculation
* rail selection
* policy checking

This makes the agent more reliable and reduces unnecessary tool-call complexity.

### Three tool surfaces

| Surface      | Who uses it                         | Character |
| ------------ | ----------------------------------- | --------- |
| **platform** | Rich HTTP API (`apps/api`)          | Full operation set: prepare/execute, policy CRUD, webhooks, capability discovery, plans |
| **mcp**      | External AI agents (`apps/mcp`)     | Curated high-level subset (~20–23 tools: `prepare_*`, plans, transactions, lists, discovery). Execute / PIN / biometrics stay on platform + mobile after the human Approvals inbox |
| **mobile**   | Expo chat / local tool UIs          | In-app experience, approval UX, biometrics |

Prefer `prepare_*` → approval → `execute_approved_*` everywhere (payroll, invoices, suppliers, conversions) — never a direct AI execute.

---

## 10. Approval system

Finora must never make the user wonder:

> "Did the AI just spend my money?"

Money-moving actions have explicit approval policies.

For example:

### Small payment

May be automatically allowed depending on the user's policy.

### Large payment

Requires approval.

### New beneficiary

Requires additional verification.

### Payroll

Requires explicit approval.

### Sensitive action

Requires PIN/biometric authentication.

The user sees something like:

> **Payment ready**
>
> Ama Mensah
> GHS 500
> MTN Mobile Money
> Fee: GHS 2
> Arrival: Instant
>
> **Approve**

Then Face ID/biometric or transaction PIN.

Only after approval does execution happen.

---

## 11. The AI activity UI

We don't expose raw chain-of-thought.

We also don't want users staring at:

```text
resolve_recipient()
prepare_payment()
get_balance()
```

Instead, the UI shows an understandable execution timeline.

For example:

```text
● Finding recipient...

✓ Found Ama Mensah

● Checking your balance...

✓ Sufficient funds

● Preparing payment...

✓ Payment ready

● Waiting for approval...
```

Our Thinking Orbs are used as the visual language for these AI processing states.

They are deliberately simple animated dotted orbs—not a complicated component system.

---

## 12. Rich UI generated from tool results

The AI can respond with structured financial components instead of only text.

For example:

### Balance

```text
Total balance

GHS 12,430

USDT 4,120
USD 320
```

### Payment

```text
Payment

Ama Mensah

GHS 500

MTN Mobile Money

Fee: GHS 2

[Approve]
```

### Financial insight

```text
You spent 18% more on transport
this month.

Potential savings:
GHS 240/month
```

### Execution plan

```text
Today's financial plan

✓ Payroll
✓ AWS invoice
✓ Supplier payment
✓ Rent

Total: GHS 50,542

[Review & Approve]
```

---

## 13. Financial Memory

This is one of Finora's biggest differentiators.

Finora shouldn't forget the user after every conversation.

It builds a persistent financial profile.

For example:

> "Ama is my landlord."

Finora remembers it.

Later:

> "Pay Ama."

Finora already knows who Ama is.

It can also remember:

* preferred currency
* preferred payment methods
* recurring recipients
* financial goals
* savings habits
* suppliers
* business patterns
* recurring bills
* spending patterns
* user preferences

The experience becomes more personalized over time.

---

## 14. Memory is not simply chat history

We don't dump the user's entire conversation history into every prompt.

Instead:

```text
Conversation
      ↓
Memory extraction
      ↓
Structured memory
      ↓
Database / vector search
      ↓
Relevant memories
      ↓
AI context
```

For example:

```text
User prefers USDT
Confidence: 97%

Ama is landlord
Confidence: 99%

User wants to save GHS 5,000/month
Confidence: 92%
```

When relevant, those memories are retrieved and provided to the model.

---

## 15. Finora becomes proactive

This is where the product gets much more interesting.

Instead of waiting for:

> "What's wrong with my finances?"

Finora can say:

> "Your AWS spending increased 18% this month."

Or:

> "Your balance will likely fall below your GHS 10,000 target next Tuesday."

Or:

> "You usually convert USDT on Fridays. Today's rate is better than your recent average."

Or:

> "You have three invoices due tomorrow."

This is powered by background jobs and financial analysis.

---

## 16. Inngest

Inngest fits into the backend as our **event-driven/background workflow system**.

The main chat should be fast.

We don't want the user waiting while Finora does background work.

So:

```text
User sends message
       ↓
AI responds immediately
       ↓
Background events
       ↓
Inngest
       ↓
Long-running jobs
```

Inngest can handle:

* Memory extraction
* Embedding generation
* Gmail synchronization
* Invoice scanning
* Scheduled payments
* Recurring payments
* Financial analysis
* Notifications
* Spending analysis
* Proactive insights
* Automation execution
* Retryable workflows

For example:

```text
payment.completed
        ↓
Inngest
        ↓
Update transaction
        ↓
Update memory
        ↓
Generate receipt
        ↓
Send notification
        ↓
Update financial insights
```

---

## 17. Gmail integration

Users can connect Gmail.

Finora can then:

* Find invoices
* Extract invoice information
* Detect payment deadlines
* Identify suppliers
* Prepare invoice payments
* Remind users about unpaid invoices

Example:

> "Find any invoices I haven't paid."

Finora searches Gmail, identifies invoices, checks the financial system, and tells the user what's outstanding.

---

## 18. Cards

If supported by the WeWire capabilities we're integrating, cards become another Finora financial capability.

A user can say:

> "Create a virtual card for my Netflix subscription."

Or:

> "Create a USD card for Meta ads with a $300 limit."

Finora prepares the card and renders it inside the app.

Card management can include:

* Create
* Freeze
* Unfreeze
* Limits
* Merchant restrictions
* Transaction history
* Delete
* Secure card-detail access

---

## 19. Crypto

Finora isn't limited to fiat.

The product can support crypto/stablecoin workflows through the relevant WeWire capabilities.

For example:

> "Send 500 USDT to this address."

Or:

> "What's the cheapest network to send USDT?"

The agent can:

* Validate an address
* Compare networks
* Estimate fees
* Prepare the transfer
* Request approval
* Execute

And users can have receive flows as well:

* Crypto addresses
* Receive QR codes
* Payment requests
* Wallet balances
* Stablecoin transfers

---

## 20. African payments

This is particularly important to our positioning.

Finora can sit above payment methods such as:

* Bank transfers
* Mobile Money
* Stablecoins
* Fiat
* Cross-border payment rails supported by WeWire

So someone could say:

> "Send my supplier in Nigeria the equivalent of $2,000 using the cheapest available route."

Finora can determine the available options, calculate costs, prepare the transaction, and ask for approval.

That gives us a strong **African cross-border commerce** use case.

---

## 21. Business automation

A business owner could tell Finora:

> "Pay my suppliers every Friday."

Or:

> "Keep my operating balance above GHS 10,000."

Or:

> "Pay invoices under GHS 500 automatically, but ask me before anything larger."

These become **financial policies and automations**.

The AI doesn't just perform one transaction.

It manages an ongoing financial workflow.

---

## 22. MCP is the bigger product

The mobile app is only one way to access Finora.

Our MCP server allows external AI agents to use Finora.

For example:

### ChatGPT

> "Pay my supplier."

### Claude

> "Show my business cash flow."

### Cursor

> "Pay the Vercel invoice if it's under $50."

### Claude Code

> "Renew our infrastructure subscription."

### Other AI agents

They can potentially use the same financial capabilities.

That means Finora becomes a **financial capability layer for AI agents**.

Supported AI clients include:

- ChatGPT
- Claude Desktop / Claude Code
- Cursor
- Gemini
- VS Code AI
- Enterprise AI agents
- Custom AI agents

```text
ChatGPT
  "Pay Ama 500 USDT"
  ↓
MCP
  ↓
Finora Backend
  ↓
WeWire
  ↓
Approval Request
  ↓
Payment
```

The AI never stores credentials or directly moves money. It simply calls tools exposed by Finora.

---

## 23. Other interfaces

The same backend can eventually power:

* WhatsApp
* SMS
* Telegram
* Slack
* Microsoft Teams
* Voice assistants
* Enterprise software
* Accounting platforms
* ERP systems
* Developer applications

For example, WhatsApp:

> Send Ama 500.

Finora:

> I found Ama Mensah on MTN Mobile Money. Send GHS 500?

User:

> Yes.

Approval.

Payment.

Same Finora infrastructure.

---

## 24. The mobile app is not the MCP

We have two major products:

### Finora App

The consumer/business experience.

```text
Chat
Accounts
Wallets
Cards
Transactions
Invoices
Automations
Memory
Settings
```

### Finora MCP

The developer/AI-agent interface.

```text
AI Agent
   ↓
Finora MCP
   ↓
Finora financial tools
   ↓
WeWire
```

They use the **same underlying backend and financial account**.

---

## 25. Authentication for MCP

An external AI such as ChatGPT connects to Finora's MCP server.

The user authenticates with Finora, ideally through OAuth.

Conceptually:

```text
ChatGPT
   ↓
Connect Finora
   ↓
Finora authentication
   ↓
User grants permissions
   ↓
OAuth token
   ↓
MCP
   ↓
Finora account
```

The MCP request is associated with the authenticated Finora user.

The external AI therefore doesn't get unrestricted access.

Permissions and financial policies still live on our backend.

---

## 26. The AI model

We are currently considering strong agentic models such as Grok, Claude, or other current frontier models rather than tying the architecture to a single model.

The important architectural decision is:

**The model is replaceable.**

We should never build Finora around one provider.

Our backend should have an AI abstraction:

```text
Finora AI Orchestrator
        │
   Model Adapter
        │
 ┌──────┼────────┐
 │      │        │
Grok  Claude   Other
```

This allows us to change models without rewriting the mobile application or financial infrastructure.

---

## 27. Streaming

The mobile app should receive AI responses as a stream.

The architecture is:

```text
React Native
     ↓
Finora API
     ↓
AI Orchestrator
     ↓
LLM
     ↓
Streaming response
     ↓
React Native
```

The UI can show:

> Checking your balance...

then:

> I found three invoices...

then the final structured component.

This makes the application feel extremely fast.

The LLM API keys and tool execution remain on the backend—not inside the Expo application.

---

## 28. Storage architecture

We should separate responsibilities.

### PostgreSQL

Source of truth:

* Users
* Accounts
* Transactions
* Wallets
* Approvals
* KYC
* Beneficiaries
* Invoices
* Suppliers
* Payroll
* Policies
* Memories
* Audit logs

### Redis

Fast temporary data:

* Caching
* Sessions
* Rate limiting
* Temporary state

### KV

Lightweight key-value state:

* Preferences
* Feature flags
* Lightweight application state
* Recent context

### pgvector

Semantic financial memory.

This gives us a clean architecture without introducing unnecessary databases.

---

## 29. Local-first mobile experience

The mobile app should feel extremely fast.

We can cache locally:

* Chat history
* Recent transactions
* Preferences
* UI state
* Cached financial information

But money-moving operations always go through the backend.

So:

```text
Mobile
  │
  ├── Local cache → instant UI
  │
  └── API → authoritative financial state
                    ↓
                  WeWire
```

The device should never be the authority for whether money was actually transferred.

---

## 30. Core technology direction

### Mobile

* Expo (SDK 54)
* React Native
* Expo Router
* TypeScript
* NativeWind v5
* `@assistant-ui/react-native`
* Reanimated
* FlashList
* Local storage/cache

### Backend

* Bun
* Hono
* TypeScript
* Drizzle
* PostgreSQL/Neon
* Redis/Upstash
* Inngest

### Infrastructure

* Cloudflare Workers
* Cloudflare R2 where needed
* Queues/background infrastructure
* CDN

### AI

* Model-agnostic AI orchestration layer
* Streaming
* Tool calling
* MCP
* Persistent memory

### Financial infrastructure

* WeWire APIs

---

## 31. Monorepo layout

| Path              | Purpose                                       |
| ----------------- | --------------------------------------------- |
| `apps/mobile`     | Expo React Native app (conversation UI)       |
| `apps/api`        | Finora backend (Hono on Cloudflare Workers)   |
| `apps/mcp`        | Finora MCP server (Cloudflare Workers)        |
| `packages/shared` | Shared Zod schemas, types, tool registry      |
| `packages/wewire` | WeWire API client (server-only)               |

---

## 32. Architecture rules

* Mobile and MCP **never call WeWire directly**. All money movement goes through `apps/api`.
* The AI never stores credentials or directly moves money.
* All financial operations flow through Policy Engine → Approval Engine → Audit Logs → WeWire APIs.
* Three tool surfaces (`mobile` | `platform` | `mcp`) live in [`packages/shared/src/registry.ts`](../packages/shared/src/registry.ts).
* Prefer `prepare_*` → approval → `execute_approved_*` everywhere — never a direct AI execute.
* **The AI is never the source of truth.** Balances, recipients, and transaction status always come from backend tools / WeWire — not from model memory.

---

## 33. The tool ecosystem

Our tool layer covers essentially the whole financial lifecycle.

Examples include:

### Accounts

```text
create_financial_account
get_financial_account
```

### Wallets

```text
list_wallets
get_wallet
get_balances
create_wallet
freeze_wallet
```

### Payments

```text
resolve_recipient
preview_payment
prepare_payment
execute_approved_payment
cancel_payment
```

### Bank

```text
lookup_bank_account
verify_bank_account
prepare_bank_transfer
```

### Mobile Money

```text
lookup_mobile_money
verify_mobile_money
prepare_momo_disbursement
```

### Crypto

```text
validate_wallet_address
prepare_usdt_transfer
prepare_usdc_transfer
estimate_network_fee
select_blockchain_network
```

### FX

```text
list_fx_rates
get_fx_rate
preview_conversion
prepare_conversion
execute_approved_conversion
```

### Invoices

```text
scan_invoices
list_invoices
prepare_invoice_payment
approve_invoice
```

### Suppliers

```text
create_supplier
list_suppliers
prepare_supplier_payment
```

### Payroll

```text
create_employee
prepare_payroll
approve_payroll
```

### Automations

```text
create_automation
pause_automation
resume_automation
execute_automation
```

### AI intelligence

```text
analyze_cash_flow
summarize_spending
predict_upcoming_bills
recommend_payment_method
recommend_cheapest_rail
detect_duplicate_payments
generate_financial_insights
```

And many more. See [`docs/tools/catalog.md`](../docs/tools/catalog.md) for the live registry by category.

---

## 34. The most important design principle

We should **never make the AI the source of truth**.

If the AI says:

> "Your balance is GHS 8,400."

We don't trust its memory.

We call:

```text
get_balances()
```

If it says:

> "Ama's number is..."

We resolve the recipient.

If it says:

> "The transfer succeeded."

We verify the transaction status.

The model interprets reality.

**Finora's backend defines reality.**

---

## 35. What makes Finora different?

There are already:

* Banking apps
* Payment apps
* AI chatbots
* AI assistants
* Agent frameworks

Finora sits at the intersection.

The thesis is:

> **AI agents need financial capabilities.**

An AI can write an email.

It can write code.

It can analyze documents.

It can research companies.

But traditionally it cannot safely say:

> "I found your invoice, verified the recipient, chose the cheapest payment rail, obtained your approval, and paid it."

Finora gives it that capability.

---

## 36. The ultimate vision

Imagine an AI agent running a business.

It receives an invoice.

It understands the invoice.

It checks the business account.

It checks the company's financial policy.

It determines the appropriate payment rail.

It prepares the payment.

It requests human approval if required.

It executes the transaction.

It records the receipt.

It updates the books.

It learns the pattern.

Then it does it again next month.

**That is the future Finora is trying to enable.**

---

## 37. The flagship demo

The strongest demonstration isn't:

> "Send GHS 500."

It's:

> **"Handle everything that needs attention today."**

Finora then:

```text
Reviewing financial obligations...

✓ 3 invoices found

Checking balances...

✓ Sufficient funds

Reviewing supplier payments...

✓ 2 suppliers due

Checking FX...

✓ Better conversion route found

Building execution plan...
```

Then:

**Today's Financial Plan**

* Payroll — GHS 48,500
* Supplier A — GHS 3,400
* Supplier B — GHS 900
* AWS — $42
* FX conversion — 5,000 USDT

Finora explains:

> "I found five actions requiring attention. I've optimized the payment routes and estimated GHS 38 in savings. Two actions require your approval."

The user approves with biometrics.

Finora executes.

Then:

> **Everything is complete.**

That is the product in one interaction.

---

## 38. Where we ultimately want to go

Finora starts as a **financial AI assistant**.

It evolves into a **financial agent**.

Then it becomes the **financial infrastructure that other AI agents use**.

The progression is:

```text
AI Chat
   ↓
AI Financial Assistant
   ↓
AI Financial Agent
   ↓
Financial Operating System
   ↓
Financial Layer for AI Agents
```

---

## 39. One-liner for new team members

> **Finora gives AI agents the ability to safely understand, manage, and transact with money. We build the intelligence, financial memory, orchestration, permissions, and user experience; WeWire provides the underlying financial rails. The Finora app is where users control their financial life, while the MCP server allows external AI agents to use the same financial capabilities.**

This is substantially more defensible and scalable than a standalone payment application.
