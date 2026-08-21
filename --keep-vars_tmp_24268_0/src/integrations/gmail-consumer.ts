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

export function extractInvoiceNumber(subject: string, snippet: string) {
  return (
    `${subject} ${snippet}`.match(
      /\b(?:invoice|inv(?:oice)?\s*(?:number|no|#)?|bill)[\s:#.-]*([A-Z0-9][A-Z0-9-]{2,})\b/i,
    )?.[1] ?? null
  );
}

export function extractAmountMinor(subject: string, snippet: string) {
  const value = `${subject} ${snippet}`;
  const trailingCurrency = value.match(
    /(?:amount\s+due|total\s+due|balance\s+due|amount\s+payable|total\s+payable|payment\s+due)[^\d]{0,24}([\d,]+(?:\.\d{1,2})?)\s*(?:GHS|USD|EUR|GBP)/i,
  );
  if (trailingCurrency?.[1]) {
    const amount = Number(trailingCurrency[1].replaceAll(',', ''));
    return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : null;
  }
  const match =
    value.match(
      /(?:amount\s+due|total\s+due|balance\s+due|amount\s+payable|total\s+payable|payment\s+due)[^\d]{0,24}(?:GHS|USD|EUR|GBP|\$|£|€)\s?([\d,]+(?:\.\d{1,2})?)/i,
    ) ?? value.match(/(?:GHS|USD|EUR|GBP|\$|£|€)\s?([\d,]+(?:\.\d{1,2})?)/i);
  if (!match?.[1]) return null;
  const amount = Number(match[1].replaceAll(',', ''));
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : null;
}

export function hasInvoicePaymentEvidence(subject: string, snippet: string) {
  return /(payment|payable|amount\s+due|total\s+due|balance\s+due|bank|transfer|card|account)/i.test(
    `${subject} ${snippet}`,
  );
}

function hasInvoiceDocumentEvidence(subject: string, snippet: string) {
  return /\b(?:invoice|receipt|bill)\b|(?:amount|total|balance|payment)\s+due/i.test(
    `${subject} ${snippet}`,
  );
}

export function classifyInvoiceCandidate(candidate: {
  id: string;
  snippet?: string;
  payload?: { headers?: Array<{ name: string; value: string }> };
}) {
  const headers = new Map(
    (candidate.payload?.headers ?? []).map((header) => [header.name.toLowerCase(), header.value]),
  );
  const subject = headers.get('subject') ?? '';
  const snippet = candidate.snippet ?? '';
  const sender = (headers.get('from') ?? 'Unknown supplier').replace(/<.*>/, '').trim();
  const amountMinor = extractAmountMinor(subject, snippet);
  if (
    !amountMinor ||
    !sender ||
    sender === 'Unknown supplier' ||
    !hasInvoiceDocumentEvidence(subject, snippet)
  )
    return null;
  return { headers, subject, snippet, sender, amountMinor };
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

    if (
      !parsed.data.pageToken &&
      integration.status === 'syncing' &&
      Date.now() - integration.updatedAt.getTime() < 2 * 60_000
    ) {
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
      const candidates = await listGmailInvoiceCandidates(
        token.access_token!,
        preferences,
        parsed.data.pageToken,
      );
      for (const candidate of candidates.messages) {
        const classified = classifyInvoiceCandidate(candidate);
        if (!classified) continue;
        const detectedCurrency = `${classified.subject} ${classified.snippet}`
          .match(/\b(GHS|USD|EUR|GBP)\b/i)?.[1]
          ?.toUpperCase();
        const headers = new Map(
          (candidate.payload?.headers ?? []).map((header) => [
            header.name.toLowerCase(),
            header.value,
          ]),
        );
        const subject = headers.get('subject') ?? 'Invoice';
        const sender = (headers.get('from') ?? 'Unknown supplier').replace(/<.*>/, '').trim();
        const snippet = candidate.snippet ?? '';
        const amountMatch = snippet.match(/(?:GHS|USD|EUR|GBP|\$|£|€)\s?([\d,]+(?:\.\d{1,2})?)/i);
        const amountMinor = extractAmountMinor(subject, snippet);
        const symbol = amountMatch?.[0] ?? '';
        const currency = /GHS/i.test(symbol)
          ? 'GHS'
          : /EUR|€/i.test(symbol)
            ? 'EUR'
            : /GBP|£/i.test(symbol)
              ? 'GBP'
              : 'USD';
        const invoiceNumber =
          extractInvoiceNumber(subject, snippet) ?? `GMAIL-${candidate.id.slice(-10)}`;
        if (!amountMinor || sender === 'Unknown supplier') continue;
        await upsertGmailInvoice(db, {
          clerkUserId: integration.clerkUserId,
          gmailMessageId: candidate.id,
          gmailThreadId: candidate.threadId,
          vendor: sender.slice(0, 160),
          invoiceNumber,
          amountMinor,
          currency: detectedCurrency ?? currency,
          receivedAt: new Date(Number(candidate.internalDate ?? Date.now())),
          dueDate: extractDueDate(`${subject} ${snippet}`),
          status: 'due',
          description: snippet.slice(0, 500),
          hasAttachment: false,
          confidence: 80,
        });
      }
      const acceptedCount = candidates.messages.reduce(
        (count, candidate) => count + (classifyInvoiceCandidate(candidate) ? 1 : 0),
        0,
      );
      const candidateCount = (parsed.data.candidateCount ?? 0) + acceptedCount;
      if (candidates.nextPageToken) {
        await bindings.GMAIL_SYNC_QUEUE.send({
          kind: 'gmail.initial-sync',
          integrationId: integration.id,
          pageToken: candidates.nextPageToken,
          candidateCount,
        });
      } else {
        await markGmailSynced(db, integration.id, {
          historyId: integration.historyId ?? undefined,
          candidateCount,
        });
      }
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
