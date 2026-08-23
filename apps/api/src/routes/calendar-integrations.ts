import { CalendarConnectRequestSchema } from '@finora/shared';
import { Hono } from 'hono';

import type { AppEnv } from '../app-env';
import type { CalendarSyncQueueMessage } from '../integrations/calendar-queue';

import {
  clearCalendarSyncToken,
  consumeCalendarOAuthAttempt,
  createCalendarOAuthAttempt,
  getCalendarIntegration,
  listCalendarMoneyEvents,
  revokeCalendarIntegration,
  upsertCalendarIntegration,
} from '../db/calendar-integrations';
import { createDb } from '../db/client';
import { publicCalendarStatus } from '../integrations/calendar-reader';
import {
  CALENDAR_SCOPES,
  createCalendarAuthorizationUrl,
  exchangeCalendarCode,
  revokeGoogleCalendarToken,
} from '../integrations/google-calendar';
import { getGoogleIdentity } from '../integrations/google-gmail';
import {
  decryptSecret,
  encryptSecret,
  randomBase64Url,
  sha256Base64Url,
} from '../integrations/secret-box';

const OAUTH_ATTEMPT_TTL_MS = 10 * 60_000;

function config(env: AppEnv['Variables']['env']) {
  if (
    !env.GOOGLE_OAUTH_CLIENT_ID ||
    !env.GOOGLE_OAUTH_CLIENT_SECRET ||
    !env.GOOGLE_CALENDAR_REDIRECT_URI ||
    !env.GOOGLE_TOKEN_ENCRYPTION_KEY
  )
    return null;
  return {
    clientId: env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: env.GOOGLE_CALENDAR_REDIRECT_URI,
    encryptionKey: env.GOOGLE_TOKEN_ENCRYPTION_KEY,
  };
}

function mobileReturnUrl(value: string, environment: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'finora:' || (environment !== 'production' && url.protocol === 'exp:')
      ? value
      : null;
  } catch {
    return null;
  }
}

function redirect(returnUrl: string, result: 'connected' | 'cancelled' | 'failed') {
  const url = new URL(returnUrl);
  url.searchParams.set('calendar', result);
  return url.toString();
}

export const calendarIntegrations = new Hono<AppEnv>();
calendarIntegrations.get('/status', async (c) => {
  c.header('Cache-Control', 'no-store');
  return c.json(
    publicCalendarStatus(
      await getCalendarIntegration(createDb(c.get('env').DATABASE_URL), c.get('auth').userId),
    ),
  );
});
calendarIntegrations.get('/events', async (c) => {
  const events = (
    await listCalendarMoneyEvents(createDb(c.get('env').DATABASE_URL), c.get('auth').userId)
  ).map((event) => ({
    id: event.id,
    title: event.title,
    kind: event.kind,
    dueAt: event.dueAt.toISOString(),
    amount: event.amount ? Number(event.amount) : null,
    currency: event.currency,
    counterparty: event.counterparty,
    notes: event.notes,
    sourceUrl: event.sourceUrl,
  }));
  console.info('[Calendar] API events response', {
    userId: c.get('auth').userId,
    count: events.length,
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      kind: event.kind,
      dueAt: event.dueAt,
    })),
  });
  return c.json({ events });
});
calendarIntegrations.post('/connect', async (c) => {
  const google = config(c.get('env'));
  if (!google) return c.json({ error: 'calendar_not_configured' }, 503);
  const body = CalendarConnectRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: 'invalid_request' }, 400);
  const returnUrl = mobileReturnUrl(body.data.returnUrl, c.get('env').ENVIRONMENT);
  if (!returnUrl) return c.json({ error: 'invalid_return_url' }, 400);
  const state = randomBase64Url();
  const verifier = randomBase64Url(48);
  await createCalendarOAuthAttempt(createDb(c.get('env').DATABASE_URL), {
    clerkUserId: c.get('auth').userId,
    stateHash: await sha256Base64Url(state),
    codeVerifierCiphertext: await encryptSecret(verifier, google.encryptionKey),
    returnUrl,
    expiresAt: new Date(Date.now() + OAUTH_ATTEMPT_TTL_MS),
  });
  return c.json({
    authorizationUrl: createCalendarAuthorizationUrl({
      clientId: google.clientId,
      redirectUri: google.redirectUri,
      state,
      codeChallenge: await sha256Base64Url(verifier),
    }),
  });
});
calendarIntegrations.post('/sync', async (c) => {
  const db = createDb(c.get('env').DATABASE_URL);
  const integration = await getCalendarIntegration(db, c.get('auth').userId);
  if (!integration || integration.revokedAt)
    return c.json({ error: 'calendar_not_connected' }, 409);
  await clearCalendarSyncToken(db, integration.id);
  await c.env.CALENDAR_SYNC_QUEUE.send({
    kind: 'calendar.sync',
    integrationId: integration.id,
  } satisfies CalendarSyncQueueMessage);
  return c.json({ queued: true as const }, 202);
});
calendarIntegrations.post('/disconnect', async (c) => {
  const google = config(c.get('env'));
  const db = createDb(c.get('env').DATABASE_URL);
  const integration = await getCalendarIntegration(db, c.get('auth').userId);
  if (!integration || integration.revokedAt) return c.json(publicCalendarStatus(null));
  if (google)
    c.executionCtx.waitUntil(
      decryptSecret(integration.refreshTokenCiphertext, google.encryptionKey).then(
        revokeGoogleCalendarToken,
      ),
    );
  await revokeCalendarIntegration(db, c.get('auth').userId);
  return c.json(publicCalendarStatus(null));
});

export const calendarOAuth = new Hono<AppEnv>();
calendarOAuth.get('/callback', async (c) => {
  const google = config(c.get('env'));
  if (!google) return c.json({ error: 'calendar_not_configured' }, 503);
  const stateValue = c.req.query('state');
  if (!stateValue) return c.json({ error: 'invalid_oauth_state' }, 400);
  const db = createDb(c.get('env').DATABASE_URL);
  const attempt = await consumeCalendarOAuthAttempt(db, await sha256Base64Url(stateValue));
  if (!attempt) return c.json({ error: 'invalid_oauth_state' }, 400);
  if (c.req.query('error')) return c.redirect(redirect(attempt.returnUrl, 'cancelled'));
  const code = c.req.query('code');
  if (!code) return c.redirect(redirect(attempt.returnUrl, 'failed'));
  try {
    const token = await exchangeCalendarCode({
      clientId: google.clientId,
      clientSecret: google.clientSecret,
      redirectUri: google.redirectUri,
      code,
      codeVerifier: await decryptSecret(attempt.codeVerifierCiphertext, google.encryptionKey),
    });
    if (!token.access_token) throw new Error('google_access_token_missing');
    const existing = await getCalendarIntegration(db, attempt.clerkUserId);
    const refreshTokenCiphertext = token.refresh_token
      ? await encryptSecret(token.refresh_token, google.encryptionKey)
      : existing?.refreshTokenCiphertext;
    if (!refreshTokenCiphertext) throw new Error('google_refresh_token_missing');
    const identity = await getGoogleIdentity(token.access_token);
    const integration = await upsertCalendarIntegration(db, {
      clerkUserId: attempt.clerkUserId,
      googleSubject: identity.subject,
      email: identity.email,
      refreshTokenCiphertext,
      scopes: token.scope?.split(' ').filter(Boolean) ?? [...CALENDAR_SCOPES],
    });
    await c.env.CALENDAR_SYNC_QUEUE.send({
      kind: 'calendar.sync',
      integrationId: integration.id,
    } satisfies CalendarSyncQueueMessage);
    return c.redirect(redirect(attempt.returnUrl, 'connected'));
  } catch (error) {
    console.error('[calendar:oauth]', {
      errorName: error instanceof Error ? error.message.split(':', 1)[0] : 'unknown',
    });
    return c.redirect(redirect(attempt.returnUrl, 'failed'));
  }
});
