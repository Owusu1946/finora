import {
  cancelCalendarMoneyEvent,
  countCalendarEvents,
  getCalendarIntegrationById,
  markCalendarSynced,
  markCalendarSyncFailed,
  markCalendarSyncing,
  upsertCalendarMoneyEvent,
} from '../db/calendar-integrations';
import { createDb } from '../db/client';
import { getApiEnv } from '../env';
import { CalendarSyncQueueMessageSchema } from './calendar-queue';
import {
  listGoogleCalendarEvents,
  listGoogleCalendars,
  refreshCalendarAccessToken,
} from './google-calendar';
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
      const calendarList = await listGoogleCalendars(token.access_token);
      const calendars = calendarList.items.slice(0, 25);
      console.info('[CalendarSync] calendars received from Google', {
        integrationId: integration.id,
        userId: integration.clerkUserId,
        total: calendarList.items.length,
        processed: calendars.length,
        calendars: calendars.map((calendar) => ({
          id: calendar.id,
          summary: calendar.summary ?? null,
          primary: calendar.primary ?? false,
        })),
      });
      let processed = 0;
      let skippedCancelled = 0;
      let skippedWithoutStart = 0;
      for (const calendar of calendars) {
        let calendarPersisted = 0;
        console.info('[CalendarSync] fetching calendar events', {
          integrationId: integration.id,
          calendarId: calendar.id,
          calendarSummary: calendar.summary ?? null,
        });
        let pageToken: string | undefined;
        do {
          const result = await listGoogleCalendarEvents(token.access_token, calendar.id, {
            pageToken,
          });
          const pageEvents = result.items ?? [];
          console.info('[CalendarSync] Google events page received', {
            integrationId: integration.id,
            calendarId: calendar.id,
            calendarSummary: calendar.summary ?? null,
            pageSize: pageEvents.length,
            hasNextPage: Boolean(result.nextPageToken),
            events: pageEvents.map((event) => ({
              id: event.id,
              status: event.status ?? null,
              summary: event.summary ?? null,
              start: event.start?.dateTime ?? event.start?.date ?? null,
            })),
          });
          for (const event of pageEvents) {
            if (event.status === 'cancelled') {
              skippedCancelled += 1;
              await cancelCalendarMoneyEvent(db, integration.clerkUserId, calendar.id, event.id);
              continue;
            }
            const dueAt =
              event.start?.dateTime ??
              (event.start?.date ? `${event.start.date}T00:00:00.000Z` : null);
            if (!dueAt) {
              skippedWithoutStart += 1;
              console.info('[CalendarSync] event skipped without start time', {
                integrationId: integration.id,
                calendarId: calendar.id,
                eventId: event.id,
                summary: event.summary ?? null,
              });
              continue;
            }
            const facts = calendarEventFacts(event);
            await upsertCalendarMoneyEvent(db, {
              clerkUserId: integration.clerkUserId,
              integrationId: integration.id,
              googleEventId: event.id,
              googleCalendarId: calendar.id,
              title: (event.summary ?? 'Calendar event').slice(0, 200),
              kind: facts.kind,
              dueAt: new Date(dueAt),
              amount: facts.amount,
              currency: facts.currency,
              notes: facts.notes,
              sourceUrl: event.htmlLink ?? null,
              etag: event.etag ?? null,
            });
            processed += 1;
            calendarPersisted += 1;
            console.info('[CalendarSync] event persisted', {
              integrationId: integration.id,
              calendarId: calendar.id,
              eventId: event.id,
              summary: event.summary ?? null,
              dueAt,
              kind: facts.kind,
            });
            if (processed >= 500) break;
          }
          pageToken = processed < 500 ? result.nextPageToken : undefined;
        } while (pageToken);
        console.info('[CalendarSync] calendar completed', {
          integrationId: integration.id,
          calendarId: calendar.id,
          calendarSummary: calendar.summary ?? null,
          persisted: calendarPersisted,
        });
        if (processed >= 500) break;
      }
      const count = await countCalendarEvents(db, integration.clerkUserId);
      console.info('[CalendarSync] sync completed', {
        integrationId: integration.id,
        userId: integration.clerkUserId,
        persistedThisRun: processed,
        skippedCancelled,
        skippedWithoutStart,
        databaseEventCount: count,
      });
      await markCalendarSynced(db, integration.id, {
        eventCount: count,
      });
      message.ack();
    } catch (error) {
      const code = error instanceof Error ? error.message.split(':', 1)[0] : 'calendar_sync_failed';
      console.error('[CalendarSync] sync failed', {
        integrationId: integration.id,
        userId: integration.clerkUserId,
        error: error instanceof Error ? error.message : String(error),
      });
      const reauth = error instanceof Error && /401|invalid_grant/.test(error.message);
      await markCalendarSyncFailed(db, integration.id, code, reauth);
      if (reauth) message.ack();
      else message.retry({ delaySeconds: 60 });
    }
  }
}
