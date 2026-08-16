# Finora

Finora is a TypeScript monorepo for a financial operating system for people and AI agents.
The mobile app is an Expo client, the API is Hono on Cloudflare Workers, and the MCP server
exposes a curated set of backend capabilities. The API is the source of truth; clients never
call WeWire directly.

## Repository layout

```text
apps/mobile  Expo SDK 54 React Native app
apps/web     Next.js marketing site and public assets
apps/api     Hono API, Neon/Postgres, Clerk webhooks, queues, Resend
apps/mcp     Cloudflare MCP server
packages/env Shared environment validation
packages/shared Shared schemas, types, and capability registry
packages/wewire Server-only WeWire client
```

## Prerequisites

- Node.js 20 or newer
- pnpm 11 (`corepack enable` is not recommended)
- An Expo Go client for mobile development, or an Expo development build for native-only work
- A Clerk application with Native API enabled
- A Neon PostgreSQL database for API persistence
- Cloudflare Wrangler authenticated to the account that owns the Workers
- Resend, AgooSMS, and Deepgram accounts for production email, SMS, and voice transcription

Install dependencies from the repository root:

```bash
pnpm install
```

Never commit `.env`, `.dev.vars`, API keys, database URLs, or webhook signing secrets.
The example files contain placeholders only.

## Environment configuration

### Mobile

Copy `apps/mobile/.env.example` to `apps/mobile/.env`:

```env
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key
EXPO_PUBLIC_API_URL=https://your-api-domain.example.com
```

`EXPO_PUBLIC_API_URL` is required for production builds. During local Expo development the app
derives the LAN API URL from Metro and uses port `8788`.

### API

Copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars` and fill in the values:

```env
CLERK_SECRET_KEY=sk_test_your_key
CLERK_PUBLISHABLE_KEY=pk_test_your_key
CLERK_WEBHOOK_SIGNING_SECRET=whsec_your_clerk_endpoint_secret
DEEPGRAM_API_KEY=your_deepgram_key
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://user:password@host/database?sslmode=require
AGOO_SMS_API_KEY=your_agoosms_key
AGOO_SMS_SENDER_ID=VENTRAPOS
RESEND_API_KEY=re_your_key
RESEND_WEBHOOK_SECRET=your_resend_webhook_secret
WELCOME_EMAIL_MODE=disabled
WELCOME_EMAIL_REDIRECT_TO=
WEWIRE_API_KEY=your_wewire_key
WEWIRE_WEBHOOK_SECRET=your_wewire_webhook_secret
```

`WELCOME_EMAIL_MODE` is one of `disabled`, `redirect`, or `live`. Use `redirect` plus
`WELCOME_EMAIL_REDIRECT_TO` while testing delivery. Do not put secrets in `wrangler.toml`.
The non-secret production values (`WELCOME_EMAIL_FROM`, reply-to, CTA URL, and queue bindings)
are configured there.

### MCP

Copy `apps/mcp/.dev.vars.example` to `apps/mcp/.dev.vars`:

```env
CLERK_SECRET_KEY=sk_test_your_key
```

For local MCP development, `apps/mcp/wrangler.toml` points at
`http://127.0.0.1:8787`. Set `FINORA_API_URL` to the deployed API URL in a preview or production
Worker configuration.

## Clerk setup

1. Create a Clerk application and enable the Native API.
2. Copy the publishable key to the mobile `.env` and the secret key to API/MCP secrets.
3. Enable the authentication methods used by the app: email/password, Google, and Apple.
4. Configure the mobile OAuth application identifiers and redirect settings to match
   `apps/mobile/app.json` (`scheme: finora`).
5. After deploying the API, create a Clerk webhook endpoint at:
   `https://YOUR_API_HOST/webhooks/clerk`
6. Subscribe to `user.created` and `user.updated`.
7. Copy that endpoint's signing secret to `CLERK_WEBHOOK_SIGNING_SECRET`.

The webhook creates the asynchronous welcome-email delivery record. Profile synchronization via
`/v1/auth/me` is separate and does not prove that the webhook is working.

## Neon and database migrations

This repository does not use database migrations as they are considered an anti-pattern for typescript devs.
Rather, we leave migrations to drizzle and push schema changes directly to the database (Neon) with the command below to apply changes:

```bash
pnpm db:push
```

The API runtime uses `DATABASE_URL`.

## Cloudflare resources and secrets

Authenticate Wrangler once:

```bash
pnx --filter @finora/api wrangler login
```

Create the email queues once per Cloudflare account:

```bash
pnx --filter @finora/api wrangler queues create finora-transactional-email
pnx --filter @finora/api wrangler queues create finora-transactional-email-dlq
pnpm --filter @finora/api cf-typegen
```

Set production secrets interactively:

```bash
pnx --filter @finora/api wrangler secret put CLERK_SECRET_KEY
pnx --filter @finora/api wrangler secret put CLERK_WEBHOOK_SIGNING_SECRET
pnx --filter @finora/api wrangler secret put DEEPGRAM_API_KEY
pnx --filter @finora/api wrangler secret put DATABASE_URL
pnx --filter @finora/api wrangler secret put AGOO_SMS_API_KEY
pnx --filter @finora/api wrangler secret put AGOO_SMS_SENDER_ID
pnx --filter @finora/api wrangler secret put RESEND_API_KEY
pnx --filter @finora/api wrangler secret put RESEND_WEBHOOK_SECRET
pnx --filter @finora/api wrangler secret put WEWIRE_API_KEY
pnx --filter @finora/api wrangler secret put WEWIRE_WEBHOOK_SECRET
```

`WELCOME_EMAIL_MODE` is a normal Wrangler variable, not a secret. Change it in `wrangler.toml`
and redeploy. To update an existing secret, run the same `wrangler secret put NAME` command again.

Deploy the API with:

```bash
pnpm --filter @finora/api deploy
```

## Resend welcome email setup

The delivery path is:

```text
Clerk webhook -> Hono API -> Neon delivery ledger -> Cloudflare Queue -> Resend
```

1. Verify `mail.askorin.app` in Resend.
2. Add the exact DKIM, SPF/return-path, and MX records Resend provides at the authoritative DNS
   provider. Do not invent record values.
3. Use `Finora <welcome@mail.askorin.app>` as the verified sender.
4. Configure `hello@askorin.app` as the reply-to address and route it to the support inbox.
5. Create a Resend webhook at `https://YOUR_API_HOST/webhooks/resend` and subscribe to sent,
   delivered, delayed, bounced, complained, suppressed, and failed events.
6. Store the Resend webhook signing secret as `RESEND_WEBHOOK_SECRET`.
7. Deploy the web app before the API so this email logo is publicly available:
   `https://YOUR_VERCEL_HOST/images/finora/email-logo.png`

For staging, use `WELCOME_EMAIL_MODE=redirect`; use `live` only after DNS, webhook, and queue
checks pass.

## Local development

Run the complete workspace:

```bash
pnpm dev
```

For a physical phone, use separate terminals so the API is reachable over the LAN:

```bash
# Terminal 1
pnpm dev:api

# Terminal 2
pnpm dev:lan

# Terminal 3
pnpm dev:mobile
```

The LAN proxy exposes `http://YOUR_COMPUTER_LAN_IP:8788` and the mobile app detects it from
Metro. Keep the phone and computer on the same network. If ports `8081` or `3001` are already in
use, stop the process you started or run that app on another port.

Run the web app alone with `pnpm dev:web`. Run MCP alone with
`pnpm --filter @finora/mcp dev`.

## Verification and quality checks

Before opening a pull request:

```bash
pnpm check
pnpm check-types
pnpm --filter @finora/api test
pnpm build
```

For a welcome-email smoke test, create one email/password user and one social-login user. Verify
the Clerk webhook attempt succeeds, one Neon delivery row exists per Clerk user, the queue has
processed the message, and Resend shows the provider event. Never use real customer data in tests.

For voice transcription, set `DEEPGRAM_API_KEY`, run the API and LAN proxy, then tap the composer
microphone button in Expo Go. Tap again to stop and verify the transcript is inserted for review
without sending the message. Recordings are limited to 45 seconds, are not persisted by Finora,
and are deleted from the device after transcription, failure, or cancellation.

## Contribution rules

- Keep financial execution behind prepare -> policy check -> human approval -> PIN/biometrics ->
  execute -> audit.
- Mobile and MCP must call the API; they must never call WeWire directly.
- Keep shared schemas and capability names in `packages/shared`.
- Do not expose credentials, passcodes, or execution endpoints through MCP.
- Keep commits small and use conventional commit messages.
- Do not commit directly to `main` unless explicitly authorized.
