import {
  DriveConnectRequestSchema,
  DriveFileContentSchema,
  DriveSearchResponseSchema,
} from '@finora/shared';
import { Hono } from 'hono';

import type { AppEnv } from '../app-env';

import { createDb } from '../db/client';
import {
  getDriveIntegration,
  revokeDriveIntegration,
  upsertDriveIntegration,
} from '../db/drive-integrations';
import { consumeOAuthAttempt, createOAuthAttempt } from '../db/gmail-integrations';
import {
  createDriveAuthorizationUrl,
  exchangeDriveCode,
  getDriveFileContent,
  getDriveFileMetadata,
  getDriveIdentity,
  refreshDriveAccessToken,
  searchDriveFiles,
  DRIVE_SCOPES,
} from '../integrations/google-drive';
import {
  decryptSecret,
  encryptSecret,
  randomBase64Url,
  sha256Base64Url,
} from '../integrations/secret-box';

const driveConfig = (env: AppEnv['Variables']['env']) =>
  env.GOOGLE_OAUTH_CLIENT_ID &&
  env.GOOGLE_OAUTH_CLIENT_SECRET &&
  env.GOOGLE_TOKEN_ENCRYPTION_KEY &&
  env.GOOGLE_DRIVE_REDIRECT_URI
    ? {
        clientId: env.GOOGLE_OAUTH_CLIENT_ID,
        clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
        encryptionKey: env.GOOGLE_TOKEN_ENCRYPTION_KEY,
        redirectUri: env.GOOGLE_DRIVE_REDIRECT_URI,
      }
    : null;
const returnUrl = (value: string, environment: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'finora:' || (environment !== 'production' && url.protocol === 'exp:')
      ? value
      : null;
  } catch {
    return null;
  }
};
const resultUrl = (value: string, result: string) => {
  const url = new URL(value);
  url.searchParams.set('drive', result);
  return url.toString();
};

export const driveIntegrations = new Hono<AppEnv>();
driveIntegrations.get('/status', async (c) => {
  const row = await getDriveIntegration(createDb(c.get('env').DATABASE_URL), c.get('auth').userId);
  return c.json({
    connected: Boolean(row && !row.revokedAt),
    email: row?.email ?? null,
    status: row?.revokedAt ? 'disconnected' : (row?.status ?? 'disconnected'),
    lastSyncedAt: row?.lastSyncedAt?.toISOString() ?? null,
    fileCount: row?.fileCount ?? 0,
    errorCode: row?.lastErrorCode ?? null,
  });
});
driveIntegrations.post('/connect', async (c) => {
  const config = driveConfig(c.get('env'));
  const body = DriveConnectRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!config) return c.json({ error: 'drive_not_configured' }, 503);
  if (!body.success) return c.json({ error: 'invalid_request' }, 400);
  const mobileUrl = returnUrl(body.data.returnUrl, c.get('env').ENVIRONMENT);
  if (!mobileUrl) return c.json({ error: 'invalid_return_url' }, 400);
  const state = randomBase64Url();
  const verifier = randomBase64Url(48);
  await createOAuthAttempt(
    createDb(c.get('env').DATABASE_URL),
    {
      clerkUserId: c.get('auth').userId,
      stateHash: await sha256Base64Url(state),
      codeVerifierCiphertext: await encryptSecret(verifier, config.encryptionKey),
      returnUrl: mobileUrl,
      expiresAt: new Date(Date.now() + 600_000),
    },
    'drive',
  );
  return c.json({
    authorizationUrl: createDriveAuthorizationUrl({
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      state,
      codeChallenge: await sha256Base64Url(verifier),
    }),
  });
});
driveIntegrations.post('/disconnect', async (c) => {
  await revokeDriveIntegration(createDb(c.get('env').DATABASE_URL), c.get('auth').userId);
  return c.json({
    connected: false,
    email: null,
    status: 'disconnected',
    lastSyncedAt: null,
    fileCount: 0,
    errorCode: null,
  });
});
driveIntegrations.get('/search', async (c) => {
  const config = driveConfig(c.get('env'));
  if (!config) return c.json({ error: 'drive_not_configured' }, 503);
  const row = await getDriveIntegration(createDb(c.get('env').DATABASE_URL), c.get('auth').userId);
  if (!row || row.revokedAt) return c.json({ error: 'drive_not_connected' }, 409);
  try {
    const token = await refreshDriveAccessToken({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      refreshToken: await decryptSecret(row.refreshTokenCiphertext, config.encryptionKey),
    });
    const result = await searchDriveFiles(token.access_token, c.req.query('query') ?? '');
    return c.json(
      DriveSearchResponseSchema.parse({
        files: (result.files ?? []).map((file) => ({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          modifiedTime: file.modifiedTime ?? null,
          webUrl: file.webViewLink ?? null,
          snippet: file.description ?? null,
        })),
        nextPageToken: result.nextPageToken ?? null,
      }),
    );
  } catch (error) {
    console.error('[drive:search]', error);
    return c.json({ error: 'drive_search_failed' }, 502);
  }
});
driveIntegrations.get('/files/:fileId', async (c) => {
  const config = driveConfig(c.get('env'));
  if (!config) return c.json({ error: 'drive_not_configured' }, 503);
  const row = await getDriveIntegration(createDb(c.get('env').DATABASE_URL), c.get('auth').userId);
  if (!row || row.revokedAt) return c.json({ error: 'drive_not_connected' }, 409);
  try {
    const token = await refreshDriveAccessToken({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      refreshToken: await decryptSecret(row.refreshTokenCiphertext, config.encryptionKey),
    });
    const file = await getDriveFileMetadata(token.access_token, c.req.param('fileId'));
    const content = await getDriveFileContent(token.access_token, file);
    return c.json(
      DriveFileContentSchema.parse({
        file: {
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          modifiedTime: file.modifiedTime ?? null,
          webUrl: file.webViewLink ?? null,
          snippet: file.description ?? null,
        },
        ...content,
      }),
    );
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : 'drive_file_read_failed';
    console.error('[drive:file]', { fileId: c.req.param('fileId'), errorCode });
    const status =
      errorCode === 'drive_file_too_large'
        ? 413
        : errorCode === 'drive_file_format_not_supported'
          ? 415
          : 502;
    return c.json({ error: errorCode }, status);
  }
});

export const driveOAuth = new Hono<AppEnv>();
driveOAuth.get('/callback', async (c) => {
  const config = driveConfig(c.get('env'));
  if (!config) return c.text('Drive is not configured.', 503);
  const attempt = await consumeOAuthAttempt(
    createDb(c.get('env').DATABASE_URL),
    await sha256Base64Url(c.req.query('state') ?? ''),
    'drive',
  );
  if (!attempt) return c.text('Invalid OAuth state.', 400);
  if (c.req.query('error')) return c.redirect(resultUrl(attempt.returnUrl, 'cancelled'));
  try {
    const token = await exchangeDriveCode({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
      code: c.req.query('code') ?? '',
      codeVerifier: await decryptSecret(attempt.codeVerifierCiphertext, config.encryptionKey),
    });
    if (!token.access_token) throw new Error('google_drive_access_token_missing');
    const identity = await getDriveIdentity(token.access_token);
    const existing = await getDriveIntegration(
      createDb(c.get('env').DATABASE_URL),
      attempt.clerkUserId,
    );
    const refreshTokenCiphertext = token.refresh_token
      ? await encryptSecret(token.refresh_token, config.encryptionKey)
      : existing?.refreshTokenCiphertext;
    if (!refreshTokenCiphertext) throw new Error('google_drive_refresh_token_missing');
    await upsertDriveIntegration(createDb(c.get('env').DATABASE_URL), {
      clerkUserId: attempt.clerkUserId,
      googleSubject: identity.sub,
      email: identity.email ?? '',
      refreshTokenCiphertext,
      scopes: token.scope?.split(' ').filter(Boolean) ?? [...DRIVE_SCOPES],
    });
    return c.redirect(resultUrl(attempt.returnUrl, 'connected'));
  } catch (error) {
    console.error('[drive:oauth]', error);
    return c.redirect(resultUrl(attempt.returnUrl, 'failed'));
  }
});
