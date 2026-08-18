import type { ApiEnv } from '@finora/env/api';
import type { GmailIntegrationStatus } from '@finora/shared';

import type { Database } from '../db/client';

import { getGmailIntegration, markGmailReauthorizationRequired } from '../db/gmail-integrations';
import {
  getGmailMessage,
  refreshGoogleAccessToken,
  searchGmailMessages,
  type GmailSearchInput,
} from './google-gmail';
import { decryptSecret } from './secret-box';

async function accessToken(db: Database, env: ApiEnv, userId: string) {
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET;
  const encryptionKey = env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!clientId || !clientSecret || !encryptionKey) {
    throw new Error('gmail_not_configured');
  }
  const integration = await getGmailIntegration(db, userId);
  if (!integration || integration.revokedAt || integration.status === 'reauthorization_required') {
    throw new Error('gmail_not_connected');
  }
  const refreshToken = await decryptSecret(integration.refreshTokenCiphertext, encryptionKey);
  try {
    const token = await refreshGoogleAccessToken({
      clientId,
      clientSecret,
      refreshToken,
    });
    return token.access_token;
  } catch (error) {
    const errorCode = error instanceof Error ? error.message.split(':', 1)[0] : 'gmail_token_refresh_failed';
    const requiresReauthorization = errorCode.includes('invalid_grant') || errorCode.includes('401');
    if (requiresReauthorization) {
      await markGmailReauthorizationRequired(db, integration.id, errorCode);
      throw new Error('gmail_reauthorization_required');
    }
    throw error;
  }
}

export function publicGmailStatus(
  integration: Awaited<ReturnType<typeof getGmailIntegration>> | null,
): GmailIntegrationStatus {
  if (!integration || integration.revokedAt) {
    return {
      connected: false,
      email: null,
      status: 'disconnected',
      lastSyncedAt: null,
      candidateCount: 0,
      errorCode: null,
    };
  }
  const syncTimedOut =
    integration.status === 'syncing' && Date.now() - integration.updatedAt.getTime() > 2 * 60_000;
  return {
    connected: integration.status !== 'reauthorization_required',
    email: integration.email,
    status: syncTimedOut ? 'error' : integration.status,
    lastSyncedAt: integration.lastSyncedAt?.toISOString() ?? null,
    candidateCount: integration.candidateCount,
    errorCode: syncTimedOut ? 'sync_timed_out' : integration.lastErrorCode,
  };
}

export async function getGmailStatus(db: Database, userId: string) {
  return publicGmailStatus(await getGmailIntegration(db, userId));
}

export function createGmailReader(db: Database, env: ApiEnv, userId: string) {
  return {
    async search(input: GmailSearchInput) {
      return searchGmailMessages(await accessToken(db, env, userId), input);
    },
    async message(messageId: string) {
      return getGmailMessage(await accessToken(db, env, userId), messageId);
    },
  };
}
