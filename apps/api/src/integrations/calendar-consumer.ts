import {
  cancelCalendarMoneyEvent,
  clearCalendarSyncToken,
  getCalendarIntegrationById,
  listCalendarMoneyEvents,
  markCalendarSynced,
  markCalendarSyncFailed,
  markCalendarSyncing,
  upsertCalendarMoneyEvent,
} from '../db/calendar-integrations';
import { createDb } from '../db/client';
import { getApiEnv } from '../env';
import { CalendarSyncQueueMessageSchema } from './calendar-queue';
import { listGoogleCalendarEvents, refreshCalendarAccessToken } from './google-calendar';
import { decryptSecret } from './secret-box';

export function classifyCalendarMoneyEvent(event: { summary?: string; description?: string }) {
  const text = `${event.summary ?? ''} ${event.description ?? ''}`.trim();
  if (!/(invoice|bill|rent|payroll|subscription|renewal|tax|payment|due|fee)/i.test(text))
    return null;
  const amount = text.match(/(?:GHS|USD|EUR|GBP|\$|£|€)\s?([\d,]+(?:\.\d{1,2})?)/i);
  const currency = text.match(/\b(GHS|USD|EUR|GBP)\b/i)?.[1]?.toUpperCase() ?? null;
  const kind = /rent/i.test(text)
    ? 'rent'
    : /payroll/i.test(text)
      ? 'payroll'
      : /subscription|renewal/i.test(text)
        ? 'subscription'
        : /tax/i.test(text)
          ? 'tax'
          : /invoice|bill|payment|due/i.test(text)
            ? 'bill'
            : 'other';
  return {
    kind,
    amount: amount?.[1]?.replaceAll(',', '') ?? null,
    currency,
    notes: text.slice(0, 500),
  };
}

function calendarEventFacts(event: { summary?: string; description?: string }) {
  const classified = classifyCalendarMoneyEvent(event);
  return {
    kind: classified?.kind ?? 'other',
    amount: classified?.amount ?? null,
    currency: classified?.currency ?? null,
    notes: `${event.summary ?? ''} ${event.description ?? ''}`.trim().slice(0, 500) || null,
  };
}

export async function consumeCalendarSyncQueue(batch: MessageBatch<unknown>, bindings: Env) {
  const env = getApiEnv(bindings);
  const db = createDb(env.DATABASE_URL);
  for (const message of batch.messages) {
    const parsed = CalendarSyncQueueMessageSchema.safeParse(message.body);
    if (
      !parsed.success ||
      !env.GOOGLE_OAUTH_CLIENT_ID ||
      !env.GOOGLE_OAUTH_CLIENT_SECRET ||
      !env.GOOGLE_TOKEN_ENCRYPTION_KEY
    ) {
      message.ack();
      continue;
    }
    const integration = await getCalendarIntegrationById(db, parsed.data.integrationId);
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
    await markCalendarSyncing(db, integration.id);
    try {
      const refreshToken = await decryptSecret(
        integration.refreshTokenCiphertext,
        env.GOOGLE_TOKEN_ENCRYPTION_KEY,
      );
      const token = await refreshCalendarAccessToken({
        clientId: env.GOOGLE_OAUTH_CLIENT_ID,
        clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
        refreshToken,
      });
      const result = await listGoogleCalendarEvents(token.access_token, {
        syncToken: integration.syncToken ?? undefined,
        pageToken: parsed.data.pageToken,
      });
      for (const event of result.items ?? []) {
        if (event.status === 'cancelled') {
          await cancelCalendarMoneyEvent(db, integration.clerkUserId, event.id);
          continue;
        }
        const dueAt =
          event.start?.dateTime ?? (event.start?.date ? `${event.start.date}T00:00:00.000Z` : null);
        if (!dueAt) continue;
        const facts = calendarEventFacts(event);
        await upsertCalendarMoneyEvent(db, {
          clerkUserId: integration.clerkUserId,
          integrationId: integration.id,
          googleEventId: event.id,
          title: (event.summary ?? 'Financial event').slice(0, 200),
          kind: facts.kind,
          dueAt: new Date(dueAt),
          amount: facts.amount,
          currency: facts.currency,
          notes: facts.notes,
          sourceUrl: event.htmlLink ?? null,
          etag: event.etag ?? null,
        });
      }
      if (result.nextPageToken) {
        await bindings.CALENDAR_SYNC_QUEUE.send({
          kind: 'calendar.sync',
          integrationId: integration.id,
          pageToken: result.nextPageToken,
        });
        message.ack();
        continue;
      }
      const count = (await listCalendarMoneyEvents(db, integration.clerkUserId)).length;
      await markCalendarSynced(db, integration.id, {
        syncToken: result.nextSyncToken ?? integration.syncToken ?? undefined,
        eventCount: count,
      });
      message.ack();
    } catch (error) {
      const code = error instanceof Error ? error.message.split(':', 1)[0] : 'calendar_sync_failed';
      if (error instanceof Error && error.message.includes('_410')) {
        await clearCalendarSyncToken(db, integration.id);
        message.retry({ delaySeconds: 5 });
        continue;
      }
      const reauth = error instanceof Error && /401|invalid_grant/.test(error.message);
      await markCalendarSyncFailed(db, integration.id, code, reauth);
      if (reauth) message.ack();
      else message.retry({ delaySeconds: 60 });
    }
  }
}
