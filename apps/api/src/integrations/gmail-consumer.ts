import { createDb } from '../db/client';
import {
  getGmailIntegrationById,
  markGmailSynced,
  markGmailSyncFailed,
  markGmailSyncing,
} from '../db/gmail-integrations';
import { getInvoicePreferences, upsertGmailInvoice } from '../db/invoices';
import { getApiEnv } from '../env';
import { GmailSyncQueueMessageSchema } from './gmail-queue';
import { listGmailInvoiceCandidates, refreshGoogleAccessToken } from './google-gmail';
import { decryptSecret } from './secret-box';

function extractInvoiceNumber(subject: string, snippet: string) {
  return (
    `${subject} ${snippet}`.match(/\b(?:invoice|inv|bill|receipt)[\s#:.-]*([A-Z0-9-]{3,})\b/i)?.[1] ??
    subject.slice(0, 120)
  );
}

function extractDueDate(value: string) {
  const match = value.match(/\b(?:due(?: date)?[:\s-]*)?(\d{4}-\d{2}-\d{2})\b/i);
  if (!match?.[1]) return null;
  const date = new Date(`${match[1]}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

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
      const preferences = await getInvoicePreferences(db, integration.clerkUserId);
      const candidates = await listGmailInvoiceCandidates(token.access_token!, preferences);
      for (const candidate of candidates.messages) {
        const headers = new Map(
          (candidate.payload?.headers ?? []).map((header) => [header.name.toLowerCase(), header.value]),
        );
        const subject = headers.get('subject') ?? 'Invoice';
        const sender = (headers.get('from') ?? 'Unknown supplier').replace(/<.*>/, '').trim();
        const snippet = candidate.snippet ?? '';
        const amountMatch = snippet.match(/(?:GHS|USD|EUR|GBP|\$|£|€)\s?([\d,]+(?:\.\d{1,2})?)/i);
        const amountMinor = amountMatch
          ? Math.round(Number(amountMatch[1]!.replaceAll(',', '')) * 100)
          : 0;
        const symbol = amountMatch?.[0] ?? '';
        const currency = /GHS/i.test(symbol) ? 'GHS' : /EUR|€/i.test(symbol) ? 'EUR' : /GBP|£/i.test(symbol) ? 'GBP' : 'USD';
        await upsertGmailInvoice(db, {
          clerkUserId: integration.clerkUserId,
          gmailMessageId: candidate.id,
          gmailThreadId: candidate.threadId,
          vendor: sender.slice(0, 160),
          invoiceNumber: extractInvoiceNumber(subject, snippet),
          amountMinor,
          currency,
          receivedAt: new Date(Number(candidate.internalDate ?? Date.now())),
          dueDate: extractDueDate(`${subject} ${snippet}`),
          status: 'due',
          description: snippet.slice(0, 500),
          hasAttachment: false,
          confidence: amountMinor > 0 ? 70 : 35,
        });
      }
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
