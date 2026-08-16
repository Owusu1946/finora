# @finora/api

Finora backend on Cloudflare Workers (Hono).

Owns auth, approvals, WeWire access, and webhooks.

```bash
# from repo root
cp apps/api/.dev.vars.example apps/api/.dev.vars
pnpm --filter @finora/api dev
```

Database schema changes use Drizzle's direct push workflow (Option 2). Update
`src/db/schema.ts`, generate and review the SQL artifact, then apply the reviewed
schema diff:

```bash
pnpm --filter @finora/api exec drizzle-kit generate
pnpm db:push
```

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
