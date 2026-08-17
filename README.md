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
packages/config Shared TypeScript configuration
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
GOOGLE_OAUTH_CLIENT_ID=your_google_oauth_client_id
GOOGLE_OAUTH_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_OAUTH_REDIRECT_URI=https://your-api-domain.example.com/oauth/google/callback
GOOGLE_TOKEN_ENCRYPTION_KEY=at-least-32-random-characters
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
pnpm --filter @finora/api exec wrangler login
```

Create the email and Gmail sync queues once per Cloudflare account:

```bash
pnpm --filter @finora/api exec wrangler queues create finora-transactional-email
pnpm --filter @finora/api exec wrangler queues create finora-transactional-email-dlq
pnpm --filter @finora/api exec wrangler queues create finora-gmail-sync
pnpm --filter @finora/api exec wrangler queues create finora-gmail-sync-dlq
pnpm --filter @finora/api cf-typegen
```

Set production secrets interactively:

```bash
pnpm --filter @finora/api exec wrangler secret put CLERK_SECRET_KEY
pnpm --filter @finora/api exec wrangler secret put CLERK_WEBHOOK_SIGNING_SECRET
pnpm --filter @finora/api exec wrangler secret put DEEPGRAM_API_KEY
pnpm --filter @finora/api exec wrangler secret put DATABASE_URL
pnpm --filter @finora/api exec wrangler secret put AGOO_SMS_API_KEY
pnpm --filter @finora/api exec wrangler secret put AGOO_SMS_SENDER_ID
pnpm --filter @finora/api exec wrangler secret put RESEND_API_KEY
pnpm --filter @finora/api exec wrangler secret put RESEND_WEBHOOK_SECRET
pnpm --filter @finora/api exec wrangler secret put GOOGLE_OAUTH_CLIENT_ID
pnpm --filter @finora/api exec wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET
pnpm --filter @finora/api exec wrangler secret put GOOGLE_OAUTH_REDIRECT_URI
pnpm --filter @finora/api exec wrangler secret put GOOGLE_TOKEN_ENCRYPTION_KEY
pnpm --filter @finora/api exec wrangler secret put WEWIRE_API_KEY
pnpm --filter @finora/api exec wrangler secret put WEWIRE_WEBHOOK_SECRET
```

`WELCOME_EMAIL_MODE` is a normal Wrangler variable, not a secret. Change it in `wrangler.toml`
and redeploy. To update an existing secret, run the same `wrangler secret put NAME` command again.

Deploy the API with:

```bash
pnpm deploy:api
```

## Gmail integration setup

1. In Google Cloud, create or select a project and enable the Gmail API.
2. Configure the OAuth consent screen and add the app's support and developer contact details.
3. Add `openid`, `email`, `profile`, and `https://www.googleapis.com/auth/gmail.readonly` to the consent screen.
4. Create a Web application OAuth client.
5. Add the deployed API callback as an exact authorized redirect URI:
   `https://YOUR_API_HOST/oauth/google/callback`.
6. Put the client ID, client secret, exact callback URL, and a cryptographically random encryption
   key of at least 32 characters in `.dev.vars` locally and Wrangler secrets in production.
7. Create both Gmail queues, run `pnpm db:push`, regenerate Worker types, and deploy the API.

The API owns OAuth, encrypts refresh tokens with AES-GCM, and sends no Google token to mobile.
Finora currently stores connection metadata and a bounded 90-day invoice-candidate count, not
message bodies or attachments. Gmail readonly is a restricted Google scope; public production
launch may require Google OAuth verification and an independent security assessment.

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

Run all applications in one Turbo session:

```bash
pnpm dev
```

This starts the four packages that define a `dev` script plus the phone-facing API proxy:

| Service | Address                 | Expected result                                                      |
| ------- | ----------------------- | -------------------------------------------------------------------- |
| API     | `http://127.0.0.1:8787` | Wrangler reports the API Worker ready; DevTools uses port `9230`.    |
| LAN API | `http://0.0.0.0:8788`   | Proxies physical-phone requests to the API Worker on loopback.       |
| MCP     | `http://127.0.0.1:8789` | Wrangler reports the MCP Worker ready; DevTools uses port `9231`.    |
| Web     | `http://localhost:3000` | Next.js reports the landing site ready.                              |
| Mobile  | `exp://<LAN_IP>:8081`   | Metro prints a QR code and waits for Expo Go or a development build. |

Turbo lists every workspace package as in scope, but packages without a `dev` script do not start
a process. Stop the full session with `Ctrl+C`.

The full session starts `dev:lan` automatically. The proxy exposes
`http://YOUR_COMPUTER_LAN_IP:8788`, and the mobile app derives that URL from Metro. Keep the phone
and computer on the same network. `pnpm dev:lan` remains available when the API and mobile app were
started separately.

To run only the phone-facing path, use three terminals with `pnpm dev:api`, `pnpm dev:lan`, and
`pnpm dev:mobile`.

Dev scripts will often be preferred to be ran without the `web` dev server. For that use the script below:

```bash
pnpm dev --filter='!@finora/web'
```

### Root script reference

Run these commands from the repository root:

| Command            | What it runs                                                | What to expect                                                                           |
| ------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `pnpm dev`         | API, MCP, mobile, and web dev servers through Turbo         | Persistent Turbo session on ports `8787`, `8789`, `8081`, and `3000`.                    |
| `pnpm dev:api`     | `@finora/api` development Worker                            | Persistent Wrangler server on `127.0.0.1:8787`.                                          |
| `pnpm dev:mcp`     | `@finora/mcp` development Worker                            | Persistent Wrangler server on `127.0.0.1:8789`; API calls target port `8787`.            |
| `pnpm dev:web`     | `@finora/web` Next.js development server                    | Persistent site on `localhost:3000`.                                                     |
| `pnpm dev:mobile`  | `@finora/mobile` Expo server                                | Persistent Metro server, normally on port `8081`, with a QR code.                        |
| `pnpm dev:lan`     | API LAN proxy                                               | Persistent proxy on `0.0.0.0:8788`; requires `dev:api` or `dev`.                         |
| `pnpm android`     | Expo Android launcher                                       | Starts Metro and opens or prompts for an Android target.                                 |
| `pnpm ios`         | Expo iOS launcher                                           | Starts Metro and opens an iOS simulator when supported.                                  |
| `pnpm build`       | API and MCP Wrangler dry runs plus the web production build | Validates both Workers without deploying and writes `apps/web/.next`.                    |
| `pnpm build:api`   | API Wrangler deploy dry run                                 | Bundles and validates the API Worker; does not publish it.                               |
| `pnpm build:mcp`   | MCP Wrangler deploy dry run                                 | Bundles and validates the MCP Worker; does not publish it.                               |
| `pnpm build:web`   | Web TypeScript and Next.js production build                 | Writes the production output to `apps/web/.next`.                                        |
| `pnpm preview:web` | Built Next.js site                                          | Persistent production server on `localhost:3000`; run `pnpm build:web` first.            |
| `pnpm check`       | Oxlint followed by Oxfmt                                    | Reports lint errors and rewrites files to the configured format.                         |
| `pnpm check-types` | Every workspace `check-types` script                        | Runs TypeScript checks without emitting application code.                                |
| `pnpm db:push`     | API Drizzle schema push                                     | Applies the current schema directly to the configured database; review the target first. |
| `pnpm deploy:api`  | API Wrangler deploy                                         | Publishes the API Worker to Cloudflare.                                                  |
| `pnpm deploy:mcp`  | MCP Wrangler deploy                                         | Publishes the MCP Worker to Cloudflare.                                                  |

`postinstall` runs automatically after `pnpm install` to link the mobile React and React Native
runtime dependencies. It normally should not be invoked manually.

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
