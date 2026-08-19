# @finora/api

Finora backend on Cloudflare Workers (Hono).

Owns auth, approvals, WeWire access, and webhooks.

Copy `.dev.vars.example` to `.dev.vars`, fill in the required values, then use the scripts below
from the repository root.

| Command                                 | Expected result                                                                          |
| --------------------------------------- | ---------------------------------------------------------------------------------------- |
| `pnpm dev:api`                          | Starts the API on `http://127.0.0.1:8787` with DevTools on port `9230`.                  |
| `pnpm dev:lan`                          | Starts the phone-facing proxy on `http://0.0.0.0:8788`; the API must already be running. |
| `pnpm build:api`                        | Bundles and validates the Worker with `wrangler deploy --dry-run`; nothing is published. |
| `pnpm deploy:api`                       | Publishes the API Worker and its configured bindings to Cloudflare.                      |
| `pnpm db:push`                          | Pushes `src/db/schema.ts` directly to the database selected by `DATABASE_URL`.           |
| `pnpm --filter @finora/api db:studio`   | Opens Drizzle Studio for the configured database.                                        |
| `pnpm --filter @finora/api cf-typegen`  | Regenerates `worker-configuration.d.ts` from Wrangler bindings.                          |
| `pnpm --filter @finora/api test`        | Runs the API Vitest suite once.                                                          |
| `pnpm --filter @finora/api check-types` | Runs TypeScript without emitting files.                                                  |

`dev:api` is also included in the root `pnpm dev` session. `dev:lan` is intentionally separate
because it exposes the API to physical devices on the local network.

Database schema changes use Drizzle's direct push workflow. Update `src/db/schema.ts`, confirm
that `DATABASE_URL` targets the intended database, then inspect and approve the schema diff shown
by Drizzle:

```bash
pnpm db:push
```

Do not generate or commit Drizzle migration artifacts for this repository.

## Transactional welcome email

Welcome email delivery is asynchronous:

```text
Clerk webhook -> Hono API -> Neon delivery ledger -> Cloudflare Queue -> Resend
```

The mobile app does not call Resend and does not wait for email delivery. Duplicate Clerk events
are deduplicated by `(clerk_user_id, email_kind)` in Neon and by a stable Resend idempotency key.

### DNS and addresses

1. In Resend, add and verify `mail.askorin.app`.
2. Add the exact DKIM, SPF/return-path, and MX records shown by Resend at the authoritative DNS
   provider. Namecheap host fields are relative: `resend._domainkey.mail.askorin.app` becomes
   `resend._domainkey.mail`, and `send.mail.askorin.app` becomes `send.mail`.
3. Do not create an A record for `mail.askorin.app` and do not invent DNS values.
4. Disable open and click tracking for the domain after verification.
5. Configure `hello@askorin.app` to forward to the operational inbox. Use Namecheap Email
   Forwarding only when Namecheap nameservers are authoritative; otherwise use the active DNS
   provider's email-routing service.
6. For Sign in with Apple private relay addresses, register `mail.askorin.app` as an approved
   email source in Apple Developer.

Production sender settings are defined in `wrangler.toml`:

```text
Finora <welcome@mail.askorin.app>
Reply-To: hello@askorin.app
CTA: https://askorin.app
```

### Cloudflare resources

The Worker produces and consumes `finora-transactional-email`. Failed messages are moved to
`finora-transactional-email-dlq` after the configured retries. Both queues must exist before deploy:

```bash
pnpm --filter @finora/api exec wrangler queues create finora-transactional-email
pnpm --filter @finora/api exec wrangler queues create finora-transactional-email-dlq
pnpm --filter @finora/api cf-typegen
```

### Secrets and webhooks

Local secrets belong in the ignored `apps/api/.dev.vars`. Production secrets must be uploaded
interactively; never add their values to `wrangler.toml`:

```bash
pnpm --filter @finora/api exec wrangler secret put RESEND_API_KEY
pnpm --filter @finora/api exec wrangler secret put RESEND_WEBHOOK_SECRET
pnpm --filter @finora/api exec wrangler secret put CLERK_WEBHOOK_SIGNING_SECRET
```

After deploying the API, configure these dashboard endpoints:

- Clerk: `https://<api-domain>/webhooks/clerk`, events `user.created` and `user.updated`.
- Resend: `https://<api-domain>/webhooks/resend`, events `email.sent`, `email.delivered`,
  `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.suppressed`, and
  `email.failed`.

Copy each dashboard's signing secret into the matching Worker secret. These routes are public by
design but reject requests whose raw payload signature is invalid.

### Rollout and testing

`WELCOME_EMAIL_MODE` supports `disabled`, `redirect`, and `live`. Production defaults to
`disabled`. Use `redirect` with `WELCOME_EMAIL_REDIRECT_TO` for staging, then switch to `live`
only after DNS and webhook verification succeed. Local `.dev.vars` may override the mode; for a
deployed Worker, update the non-secret `WELCOME_EMAIL_MODE` value in `wrangler.toml` and redeploy.

```bash
pnpm --filter @finora/api test
pnpm --filter @finora/api check-types
pnpm --filter @finora/api build
```

Use Resend's `delivered@resend.dev`, `bounced@resend.dev`, `complained@resend.dev`, and
`suppressed@resend.dev` addresses for provider-state tests. For the final smoke test, create one
email/password user, one Google user, and one Apple user, then confirm exactly one delivery row and
one welcome email per Clerk user.

## Gmail integration

Enable the Gmail API in Google Cloud, configure the OAuth consent screen with `openid`, `email`,
`profile`, and `https://www.googleapis.com/auth/gmail.readonly`, then create a Web application OAuth
client. Its authorized redirect URI must exactly match:

```text
https://<api-domain>/oauth/google/callback
```

Configure `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
`GOOGLE_OAUTH_REDIRECT_URI`, and a random `GOOGLE_TOKEN_ENCRYPTION_KEY` of at least 32 characters in
`.dev.vars` and production Wrangler secrets. Create the sync queue and dead-letter queue before
deployment:

```bash
pnpm --filter @finora/api exec wrangler queues create finora-gmail-sync
pnpm --filter @finora/api exec wrangler queues create finora-gmail-sync-dlq
pnpm --filter @finora/api cf-typegen
pnpm db:push
```

OAuth uses one-time state, PKCE, and encrypted refresh-token storage. Tokens never reach mobile.
The current sync stores only Gmail connection metadata and a bounded candidate count; it does not
persist message bodies or attachments. The readonly Gmail scope is restricted and may require
Google verification and a security assessment before public production use.

## Google Calendar integration

Enable the Google Calendar API in the same Google Cloud project. Add
`https://www.googleapis.com/auth/calendar.readonly` to the OAuth consent screen and register this
additional authorized redirect URI:

```text
https://<api-domain>/oauth/google-calendar/callback
```

Set `GOOGLE_CALENDAR_REDIRECT_URI` in `.dev.vars` and as a production Wrangler secret, then create
the Calendar sync queue and dead-letter queue:

```bash
pnpm --filter @finora/api exec wrangler queues create finora-calendar-sync
pnpm --filter @finora/api exec wrangler queues create finora-calendar-sync-dlq
pnpm --filter @finora/api cf-typegen
pnpm db:push
```

Calendar access is read-only. Sync is queued, bounded to upcoming events across readable calendars, and uses
bounded full refreshes. Events are stored as read-only source data, while the
chat tool applies relevance filtering for each user query. Event text is treated as untrusted data
and cannot authorize payments.
