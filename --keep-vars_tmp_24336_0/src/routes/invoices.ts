import { InvoiceDateRangeSchema, InvoicePreferencesUpdateSchema } from '@finora/shared';
import { Hono } from 'hono';

import type { AppEnv } from '../app-env';
import type { GmailSyncQueueMessage } from '../integrations/gmail-queue';

import { createDb } from '../db/client';
import {
  getInvoicePreferences,
  getInvoiceSyncState,
  listStoredInvoices,
  updateInvoicePreferences,
} from '../db/invoices';

const MAX_RANGE_DAYS = 365;

function zonedMidnight(date: string, timezone: string) {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return null;
  try {
    const candidate = Date.UTC(year, month - 1, day);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(candidate));
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const represented = Date.UTC(
      Number(value.year),
      Number(value.month) - 1,
      Number(value.day),
      Number(value.hour),
      Number(value.minute),
      Number(value.second),
    );
    return new Date(candidate - (represented - candidate));
  } catch {
    return null;
  }
}

export function parseInvoiceRange(input: unknown) {
  const parsed = InvoiceDateRangeSchema.safeParse(input);
  if (!parsed.success) return null;
  const start = zonedMidnight(parsed.data.startDate, parsed.data.timezone);
  const endExclusive = zonedMidnight(parsed.data.endDate, parsed.data.timezone);
  if (!start || !endExclusive) return null;
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  const days = (endExclusive.getTime() - start.getTime()) / 86_400_000;
  if (!Number.isFinite(days) || days < 1 || days > MAX_RANGE_DAYS) return null;
  return { ...parsed.data, start, endExclusive };
}

function encodeCursor(receivedAt: Date, id: string) {
  return btoa(JSON.stringify({ receivedAt: receivedAt.toISOString(), id }));
}

function decodeCursor(value: string | undefined) {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(atob(value)) as { receivedAt?: string; id?: string };
    if (!parsed.receivedAt || !parsed.id) return undefined;
    const receivedAt = new Date(parsed.receivedAt);
    return Number.isNaN(receivedAt.getTime()) ? undefined : { receivedAt, id: parsed.id };
  } catch {
    return undefined;
  }
}

function preferenceResponse(row: Awaited<ReturnType<typeof getInvoicePreferences>>) {
  return {
    startDate: row.startDate,
    endDate: row.endDate,
    timezone: row.timezone,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const invoiceRoutes = new Hono<AppEnv>();

invoiceRoutes.get('/preferences', async (c) => {
  const row = await getInvoicePreferences(
    createDb(c.get('env').DATABASE_URL),
    c.get('auth').userId,
  );
  return c.json(preferenceResponse(row));
});

invoiceRoutes.put('/preferences', async (c) => {
  const body = InvoicePreferencesUpdateSchema.safeParse(await c.req.json().catch(() => null));
  const range = body.success ? parseInvoiceRange(body.data) : null;
  if (!range) return c.json({ error: 'invalid_invoice_date_range' }, 400);
  const row = await updateInvoicePreferences(
    createDb(c.get('env').DATABASE_URL),
    c.get('auth').userId,
    {
      startDate: range.startDate,
      endDate: range.endDate,
      timezone: range.timezone,
    },
  );
  return c.json(preferenceResponse(row));
});

invoiceRoutes.get('/', async (c) => {
  const db = createDb(c.get('env').DATABASE_URL);
  const userId = c.get('auth').userId;
  const preference = await getInvoicePreferences(db, userId);
  const range = parseInvoiceRange({
    startDate: c.req.query('startDate') ?? preference.startDate,
    endDate: c.req.query('endDate') ?? preference.endDate,
    timezone: c.req.query('timezone') ?? preference.timezone,
  });
  if (!range) return c.json({ error: 'invalid_invoice_date_range' }, 400);
  const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 25) || 25, 1), 50);
  const rows = await listStoredInvoices(db, userId, {
    startDate: range.start,
    endDateExclusive: range.endExclusive,
    limit: limit + 1,
    cursor: decodeCursor(c.req.query('cursor')),
  });
  const hasNext = rows.length > limit;
  const visible = rows.slice(0, limit);
  const integration = await getInvoiceSyncState(db, userId);
  const needsInvoiceReconciliation = Boolean(
    integration && integration.candidateCount > 0 && visible.length === 0,
  );
  const syncTimedOut =
    integration?.status === 'syncing' && Date.now() - integration.updatedAt.getTime() > 2 * 60_000;
  const syncStatus =
    !integration || integration.revokedAt
      ? 'disconnected'
      : (integration.status === 'syncing' && !syncTimedOut) || needsInvoiceReconciliation
        ? 'syncing'
        : integration.status === 'error' || integration.status === 'reauthorization_required'
          ? 'error'
          : integration.lastSyncedAt &&
              Date.now() - integration.lastSyncedAt.getTime() < 10 * 60_000
            ? 'fresh'
            : 'stale';
  if ((syncStatus === 'stale' || needsInvoiceReconciliation) && integration) {
    c.executionCtx.waitUntil(
      c.env.GMAIL_SYNC_QUEUE.send({
        kind: 'gmail.initial-sync',
        integrationId: integration.id,
      } satisfies GmailSyncQueueMessage),
    );
  }
  const last = visible.at(-1);
  return c.json({
    invoices: visible.map((row) => ({
      id: row.id,
      vendor: row.vendor,
      invoiceNumber: row.invoiceNumber,
      amount: row.amountMinor / 100,
      currency: row.currency,
      dueDate: row.dueDate?.toISOString() ?? null,
      status: row.status,
      source: 'gmail' as const,
      description: row.description,
      receivedAt: row.receivedAt.toISOString(),
      hasAttachment: row.hasAttachment,
      confidence: row.confidence / 100,
    })),
    nextCursor: hasNext && last ? encodeCursor(last.receivedAt, last.id) : null,
    syncStatus,
    lastSyncedAt: integration?.lastSyncedAt?.toISOString() ?? null,
    preferences: preferenceResponse(preference),
  });
});

invoiceRoutes.post('/sync', async (c) => {
  const db = createDb(c.get('env').DATABASE_URL);
  const integration = await getInvoiceSyncState(db, c.get('auth').userId);
  if (!integration || integration.revokedAt) return c.json({ error: 'gmail_not_connected' }, 409);
  await c.env.GMAIL_SYNC_QUEUE.send({
    kind: 'gmail.initial-sync',
    integrationId: integration.id,
  } satisfies GmailSyncQueueMessage);
  return c.json({ queued: true as const }, 202);
});
