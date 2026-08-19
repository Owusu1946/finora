import type { Database } from '../db/client';

import { getCalendarIntegration, listCalendarMoneyEvents } from '../db/calendar-integrations';

export function publicCalendarStatus(
  integration: Awaited<ReturnType<typeof getCalendarIntegration>> | null,
) {
  if (!integration || integration.revokedAt)
    return {
      connected: false,
      email: null,
      status: 'disconnected' as const,
      lastSyncedAt: null,
      eventCount: 0,
      errorCode: null,
    };
  const timedOut =
    integration.status === 'syncing' && Date.now() - integration.updatedAt.getTime() > 2 * 60_000;
  return {
    connected: integration.status !== 'reauthorization_required',
    email: integration.email,
    status: timedOut ? ('error' as const) : integration.status,
    lastSyncedAt: integration.lastSyncedAt?.toISOString() ?? null,
    eventCount: integration.eventCount,
    errorCode: timedOut ? 'sync_timed_out' : integration.lastErrorCode,
  };
}

export function createCalendarReader(db: Database, userId: string) {
  return {
    async status() {
      return publicCalendarStatus(await getCalendarIntegration(db, userId));
    },
    async dues(range: 'week' | 'month', query?: string) {
      const integration = await getCalendarIntegration(db, userId);
      if (!integration || integration.revokedAt) return { connected: false as const, events: [] };
      const cutoff = Date.now() + (range === 'month' ? 31 : 7) * 86_400_000;
      const queryTerms = query
        ?.toLowerCase()
        .split(/\s+/)
        .filter((term) => term.length > 2);
      const events = (await listCalendarMoneyEvents(db, userId))
        .filter((event) => event.dueAt.getTime() <= cutoff)
        .filter((event) => {
          const text = `${event.title} ${event.notes ?? ''}`.toLowerCase();
          if (queryTerms?.length) return queryTerms.some((term) => text.includes(term));
          return /(invoice|bill|rent|payroll|subscription|renewal|tax|payment|due|fee)/i.test(text);
        })
        .map((event) => ({
          id: event.id,
          title: event.title,
          kind: event.kind,
          dueAt: event.dueAt.toISOString(),
          amount: event.amount ? Number(event.amount) : undefined,
          currency: event.currency ?? undefined,
          counterparty: event.counterparty ?? undefined,
          notes: event.notes ?? undefined,
          status: 'upcoming' as const,
        }));
      return { connected: true as const, events };
    },
  };
}
