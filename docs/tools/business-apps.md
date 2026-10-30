# Business apps (Composio)

Business apps let a user connect the tools their business already runs on, such as Paystack, QuickBooks, and WhatsApp Business. Composio hosts the sign-in and stores each user's credentials. Finora never sees an app's OAuth tokens or secret keys.

The Google integrations (Gmail, Calendar, Drive) keep their own OAuth flows and are not part of this.

## Where things live

| Piece                                    | File                                                                                           |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Curated catalog, app guides, contracts   | `packages/shared/src/business-apps.ts`                                                         |
| Composio REST client                     | `apps/api/src/business-apps/composio.ts`                                                       |
| Connect, list, disconnect, WhatsApp send | `apps/api/src/business-apps/service.ts`                                                        |
| Payment and balance normalizers          | `apps/api/src/business-apps/normalize.ts`                                                      |
| Chat tools and the system prompt section | `apps/api/src/business-apps/tools.ts`                                                          |
| HTTP routes (`/v1/apps`)                 | `apps/api/src/routes/business-apps.ts`                                                         |
| Integrations section, More apps screen   | `apps/mobile/components/integrations`, `apps/mobile/app/(app)/apps.tsx`                        |
| In-chat connect card and WhatsApp draft  | `apps/mobile/components/chat/SuggestAppConnectionToolUI.tsx`, `DraftWhatsAppMessageToolUI.tsx` |

## How the model chooses

Each chat turn, the API looks up which apps the user has connected (capped at 3 seconds) and adds a "Business apps" section to the system prompt. For each connected app it states what the app is the source of truth for, and which read actions to start from. The guides live in `CURATED_BUSINESS_APPS`, so adding an app means adding one entry there.

The model works by job, not by app:

| Job                           | Tool                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| Sales, "did they pay"         | `get_business_payments` (Paystack, Flutterwave, and Stripe combined, in major units) |
| Money held in payment apps    | `get_business_balances`                                                              |
| Anything else an app can read | `run_app_action`, or `find_app_actions` first                                        |
| Message a customer            | `draft_whatsapp_message` (draft only)                                                |
| App needed but not connected  | `suggest_app_connection` (Connect card)                                              |

## Missing apps

Any tool that needs an app the user hasn't connected returns `connectOptions` (business apps, plus Gmail, Drive, and Calendar). The chat renders a Connect card from that result directly, so the card doesn't depend on the model making a second call. After connecting, Continue sends "I connected X. Go ahead." and the next turn picks up the new connection. Google apps use Finora's own OAuth; everything else goes through Composio.

## Safety rules

- `run_app_action` runs only tools that Composio tags `readOnlyHint`, in apps the user has connected. The server checks both before every call, whatever the model asks for.
- Nothing in a business app moves money from chat. Refunds, transfers, and payouts are refused. Money movement still goes through Finora's `prepare_*` flows and approval.
- WhatsApp messages are drafts. Only the user's tap on Send calls `POST /v1/apps/whatsapp/messages`.
- Executions are pinned to the tool version their schema came from.
- These tools are chat-only. They are not in the MCP server or the capability registry yet.

## Setup

Set `COMPOSIO_API_KEY` (in `apps/api/.dev.vars` locally, or `wrangler secret put COMPOSIO_API_KEY`). Finora creates its Composio auth config for each app the first time someone connects it. It uses Composio's managed OAuth where it exists, otherwise a hosted form for the app's API key. Apps that need our own OAuth app (for example Xero and Shopify) show "Coming soon" under More apps.
