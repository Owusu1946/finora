# Finora — Product Vision & Architecture

> **Finora is the financial operating system for AI.** We expose financial capabilities through an MCP server so AI agents can safely transact, and we provide a beautiful mobile client where everyday users can interact with those same capabilities through natural language. Both experiences are powered by WeWire's financial infrastructure.

---

## 1. Finora Mobile App (Expo)

This is what end users download. Think of it as **ChatGPT for your money**.

Users can:

- Check balances
- Send money
- Receive money
- Connect Gmail
- Manage invoices
- Create recurring payments
- Approve transactions
- View transaction history
- Manage contacts
- Receive notifications

Everything happens through a conversational interface.

```
User
      │
      ▼
 Expo App
      │
      ▼
 Finora Backend
      │
      ▼
 WeWire APIs
```

---

## 2. Finora MCP Server

This is the real platform. It exposes financial tools to any AI that supports MCP.

Supported AI clients:

- ChatGPT
- Claude Desktop
- Cursor
- Gemini
- VS Code AI
- Enterprise AI agents
- Custom AI agents

Instead of using the Finora app, they connect to the MCP server.

```
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

## 3. Full Architecture

```
                    Finora

         ┌────────────────────┐
         │                    │
         │   Finora Backend   │
         │                    │
         └─────────┬──────────┘
                   │
        ┌──────────┴───────────┐
        │                      │
        ▼                      ▼

 Expo Mobile App        MCP Server
 (Humans)               (AI Agents)

        │                      │
        └──────────┬───────────┘
                   ▼
            Policy Engine
            Approval Engine
            Audit Logs
                   │
                   ▼
              WeWire APIs
                   │
                   ▼
      Wallets • Crypto • FX • MoMo • Banks
```

---

## 4. Key Architectural Insight

The **Expo app is a client of the Finora platform**, not the platform itself.

| Component            | Role                                  |
| -------------------- | ------------------------------------- |
| **Finora Backend**   | The core product (Hono on CF Workers) |
| **Finora MCP Server**| One interface to the backend (for AI) |
| **Expo Mobile App**  | Another interface (for humans)        |
| **WhatsApp bot**     | Future interface                      |
| **Web dashboard**    | Future interface                      |

They all use the same APIs and business logic.

---

## 5. Monorepo Layout

| Path               | Purpose                              |
| ------------------ | ------------------------------------ |
| `apps/mobile`      | Expo React Native app (conversation UI) |
| `apps/api`         | Finora backend (Hono on Cloudflare Workers) |
| `apps/mcp`         | Finora MCP server (Cloudflare Workers) |
| `packages/shared`  | Shared Zod schemas and types         |
| `packages/wewire`  | WeWire API client (server-only)      |

---

## 6. Architecture Rules

- Mobile and MCP **never call WeWire directly**. All money movement goes through `apps/api`.
- The AI never stores credentials or directly moves money.
- All financial operations flow through Policy Engine → Approval Engine → Audit Logs → WeWire APIs.

---

## 7. Hackathon Positioning

> **Finora is the financial operating system for AI. We expose financial capabilities through an MCP server so AI agents can safely transact, and we provide a beautiful mobile client where everyday users can interact with those same capabilities through natural language. Both experiences are powered by WeWire's financial infrastructure.**

This is substantially more defensible and scalable than a standalone payment application.
