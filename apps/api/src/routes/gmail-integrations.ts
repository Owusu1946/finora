import {
  GetGmailMessageInputSchema,
  SearchGmailMessagesInputSchema,
  GmailConnectRequestSchema,
} from '@finora/shared';
import { Hono } from 'hono';

import type { AppEnv } from '../app-env';
import type { GmailSyncQueueMessage } from '../integrations/gmail-queue';

import { createDb } from '../db/client';
import {
  consumeGmailOAuthAttempt,
  createGmailOAuthAttempt,
  getGmailIntegration,
  revokeGmailIntegration,
  upsertGmailIntegration,
} from '../db/gmail-integrations';
import { createGmailReader, getGmailStatus, publicGmailStatus } from '../integrations/gmail-reader';
import {
  createGoogleAuthorizationUrl,
  exchangeGoogleCode,
  getGmailProfile,
  getGoogleIdentity,
  GMAIL_SCOPES,
  revokeGoogleToken,
} from '../integrations/google-gmail';
import {
  decryptSecret,
  encryptSecret,
  randomBase64Url,
  sha256Base64Url,
} from '../integrations/secret-box';

const OAUTH_ATTEMPT_TTL_MS = 10 * 60_000;

function googleConfig(env: AppEnv['Variables']['env']) {
  if (
    !env.GOOGLE_OAUTH_CLIENT_ID ||
    !env.GOOGLE_OAUTH_CLIENT_SECRET ||
    !env.GOOGLE_OAUTH_REDIRECT_URI ||
    !env.GOOGLE_TOKEN_ENCRYPTION_KEY
  ) {
    return null;
  }
  return {
    clientId: env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: env.GOOGLE_OAUTH_REDIRECT_URI,
    encryptionKey: env.GOOGLE_TOKEN_ENCRYPTION_KEY,
  };
}

function validMobileReturnUrl(value: string, environment: string) {
  try {
    const url = new URL(value);
    if (url.protocol === 'finora:') return value;
    if (environment !== 'production' && url.protocol === 'exp:') return value;
    return null;
  } catch {
    return null;
  }
}

function redirectResult(returnUrl: string, result: 'connected' | 'cancelled' | 'failed') {
  const url = new URL(returnUrl);
  url.searchParams.set('gmail', result);
  return url.toString();
}

export const gmailIntegrations = new Hono<AppEnv>();

gmailIntegrations.get('/status', async (c) => {
  c.header('Cache-Control', 'no-store');
  return c.json(await getGmailStatus(createDb(c.get('env').DATABASE_URL), c.get('auth').userId));
});

gmailIntegrations.get('/search', async (c) => {
  const parsed = SearchGmailMessagesInputSchema.safeParse({
    keywords: c.req.query('keywords'),
    from: c.req.query('from'),
    startDate: c.req.query('startDate'),
    endDate: c.req.query('endDate'),
    hasAttachment: c.req.query('hasAttachment') === 'true' ? true : undefined,
    invoiceOnly: c.req.query('invoiceOnly') === 'true' ? true : undefined,
    limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
    cursor: c.req.query('cursor'),
  });
  if (!parsed.success) return c.json({ error: 'invalid_gmail_search' }, 400);
  try {
    const reader = createGmailReader(
      createDb(c.get('env').DATABASE_URL),
      c.get('env'),
      c.get('auth').userId,
    );
    return c.json(await reader.search(parsed.data));
  } catch (error) {
    const code = error instanceof Error ? error.message : 'gmail_search_failed';
    return c.json(
      { error: code },
      code === 'gmail_not_connected' ? 409 : code === 'gmail_not_configured' ? 503 : 502,
    );
  }
});

gmailIntegrations.get('/messages/:messageId', async (c) => {
  const parsed = GetGmailMessageInputSchema.safeParse({ messageId: c.req.param('messageId') });
  if (!parsed.success) return c.json({ error: 'invalid_gmail_message_id' }, 400);
  try {
    const reader = createGmailReader(
      createDb(c.get('env').DATABASE_URL),
      c.get('env'),
      c.get('auth').userId,
    );
    return c.json(await reader.message(parsed.data.messageId));
  } catch (error) {
    const code = error instanceof Error ? error.message : 'gmail_message_failed';
    return c.json(
      { error: code },
      code === 'gmail_not_connected' ? 409 : code === 'gmail_not_configured' ? 503 : 502,
    );
  }
});

gmailIntegrations.post('/connect', async (c) => {
  const config = googleConfig(c.get('env'));
  if (!config) return c.json({ error: 'gmail_not_configured' }, 503);
  const body = GmailConnectRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: 'invalid_request' }, 400);
  const returnUrl = validMobileReturnUrl(body.data.returnUrl, c.get('env').ENVIRONMENT);
  if (!returnUrl) return c.json({ error: 'invalid_return_url' }, 400);

  const state = randomBase64Url();
  const codeVerifier = randomBase64Url(48);
  const codeChallenge = await sha256Base64Url(codeVerifier);
  await createGmailOAuthAttempt(createDb(c.get('env').DATABASE_URL), {
    clerkUserId: c.get('auth').userId,
    stateHash: await sha256Base64Url(state),
    codeVerifierCiphertext: await encryptSecret(codeVerifier, config.encryptionKey),
    returnUrl,
    expiresAt: new Date(Date.now() + OAUTH_ATTEMPT_TTL_MS),
  });

  return c.json({
    authorizationUrl: createGoogleAuthorizationUrl({
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      state,
      codeChallenge,
    }),
  });
});

gmailIntegrations.post('/disconnect', async (c) => {
  const config = googleConfig(c.get('env'));
  const db = createDb(c.get('env').DATABASE_URL);
  const integration = await getGmailIntegration(db, c.get('auth').userId);
  if (!integration || integration.revokedAt) return c.json(publicGmailStatus(null));
  if (config) {
    const refreshToken = await decryptSecret(
      integration.refreshTokenCiphertext,
      config.encryptionKey,
    );
    c.executionCtx.waitUntil(revokeGoogleToken(refreshToken));
  }
  await revokeGmailIntegration(db, c.get('auth').userId);
  return c.json(publicGmailStatus(null));
});

gmailIntegrations.post('/sync', async (c) => {
  const integration = await getGmailIntegration(
    createDb(c.get('env').DATABASE_URL),
    c.get('auth').userId,
  );
  if (!integration || integration.revokedAt) return c.json({ error: 'gmail_not_connected' }, 409);
  await c.env.GMAIL_SYNC_QUEUE.send({
    kind: 'gmail.initial-sync',
    integrationId: integration.id,
  } satisfies GmailSyncQueueMessage);
  return c.json({ queued: true as const }, 202);
});

export const googleOAuth = new Hono<AppEnv>();

googleOAuth.get('/callback', async (c) => {
  const config = googleConfig(c.get('env'));
  if (!config) return c.json({ error: 'gmail_not_configured' }, 503);
  const state = c.req.query('state');
  if (!state) return c.json({ error: 'invalid_oauth_state' }, 400);
  const db = createDb(c.get('env').DATABASE_URL);
  const attempt = await consumeGmailOAuthAttempt(db, await sha256Base64Url(state));
  if (!attempt) return c.json({ error: 'invalid_oauth_state' }, 400);
  if (c.req.query('error')) return c.redirect(redirectResult(attempt.returnUrl, 'cancelled'));
  const code = c.req.query('code');
  if (!code) return c.redirect(redirectResult(attempt.returnUrl, 'failed'));

  try {
    const token = await exchangeGoogleCode({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
      code,
      codeVerifier: await decryptSecret(attempt.codeVerifierCiphertext, config.encryptionKey),
    });
    if (!token.access_token) throw new Error('google_access_token_missing');
    const existing = await getGmailIntegration(db, attempt.clerkUserId);
    const refreshTokenCiphertext = token.refresh_token
      ? await encryptSecret(token.refresh_token, config.encryptionKey)
      : existing?.refreshTokenCiphertext;
    if (!refreshTokenCiphertext) throw new Error('google_refresh_token_missing');
    const [identity, gmailProfile] = await Promise.all([
      getGoogleIdentity(token.access_token),
      getGmailProfile(token.access_token),
    ]);
    const integration = await upsertGmailIntegration(db, {
      clerkUserId: attempt.clerkUserId,
      googleSubject: identity.subject,
      email: gmailProfile.emailAddress ?? identity.email,
      refreshTokenCiphertext,
      scopes: token.scope?.split(' ').filter(Boolean) ?? [...GMAIL_SCOPES],
      historyId: gmailProfile.historyId,
    });
    await c.env.GMAIL_SYNC_QUEUE.send({
      kind: 'gmail.initial-sync',
      integrationId: integration.id,
    } satisfies GmailSyncQueueMessage);
    return c.redirect(redirectResult(attempt.returnUrl, 'connected'));
  } catch (error) {
    console.error('[gmail:oauth]', {
      errorName: error instanceof Error ? error.message.split(':', 1)[0] : 'unknown',
    });
    return c.redirect(redirectResult(attempt.returnUrl, 'failed'));
  }
});
