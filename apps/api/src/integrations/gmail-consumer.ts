import { createDb } from '../db/client';
import {
  getGmailIntegrationById,
  markGmailSynced,
  markGmailSyncFailed,
  markGmailSyncing,
} from '../db/gmail-integrations';
import { getApiEnv } from '../env';
import { GmailSyncQueueMessageSchema } from './gmail-queue';
import { listGmailInvoiceCandidates, refreshGoogleAccessToken } from './google-gmail';
import { decryptSecret } from './secret-box';

export async function consumeGmailSyncQueue(batch: MessageBatch<unknown>, bindings: Env) {
  const env = getApiEnv(bindings);
  const configured =
    env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET && env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  const db = createDb(env.DATABASE_URL);

  for (const message of batch.messages) {
    const parsed = GmailSyncQueueMessageSchema.safeParse(message.body);
    if (!parsed.success || !configured) {
      message.ack();
      continue;
    }
    const integration = await getGmailIntegrationById(db, parsed.data.integrationId);
    if (!integration || integration.revokedAt) {
      message.ack();
      continue;
    }

    await markGmailSyncing(db, integration.id);
    try {
      const refreshToken = await decryptSecret(
        integration.refreshTokenCiphertext,
        env.GOOGLE_TOKEN_ENCRYPTION_KEY!,
      );
      const token = await refreshGoogleAccessToken({
        clientId: env.GOOGLE_OAUTH_CLIENT_ID!,
        clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET!,
        refreshToken,
      });
      const candidates = await listGmailInvoiceCandidates(token.access_token!);
      await markGmailSynced(db, integration.id, {
        historyId: integration.historyId ?? undefined,
        candidateCount: candidates.estimate,
      });
      message.ack();
    } catch (error) {
      const errorCode =
        error instanceof Error ? error.message.split(':', 1)[0] : 'gmail_sync_failed';
      const reauthorizationRequired =
        error instanceof Error && error.message.includes('invalid_grant');
      await markGmailSyncFailed(db, integration.id, errorCode, reauthorizationRequired);
      if (reauthorizationRequired) message.ack();
      else message.retry({ delaySeconds: 60 });
    }
  }
}
