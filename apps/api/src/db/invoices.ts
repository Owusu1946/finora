import { and, desc, eq, gte, lt, or } from 'drizzle-orm';

import type { Database } from './client';

import { gmailIntegrations, invoicePreferences, invoices } from './schema';

export function defaultInvoiceRange(now = new Date()) {
  const end = now.toISOString().slice(0, 10);
  const startDate = new Date(now);
  startDate.setUTCDate(startDate.getUTCDate() - 89);
  return { startDate: startDate.toISOString().slice(0, 10), endDate: end, timezone: 'UTC' };
}

export async function getInvoicePreferences(db: Database, clerkUserId: string) {
  const [existing] = await db
    .select()
    .from(invoicePreferences)
    .where(eq(invoicePreferences.clerkUserId, clerkUserId))
    .limit(1);
  if (existing) return existing;
  const defaults = defaultInvoiceRange();
  const [created] = await db
    .insert(invoicePreferences)
    .values({ clerkUserId, ...defaults })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [concurrent] = await db
    .select()
    .from(invoicePreferences)
    .where(eq(invoicePreferences.clerkUserId, clerkUserId))
    .limit(1);
  if (!concurrent) throw new Error('invoice_preferences_unavailable');
  return concurrent;
}

export async function updateInvoicePreferences(
  db: Database,
  clerkUserId: string,
  input: { startDate: string; endDate: string; timezone: string },
) {
  const [result] = await db
    .insert(invoicePreferences)
    .values({ clerkUserId, ...input })
    .onConflictDoUpdate({
      target: invoicePreferences.clerkUserId,
      set: { ...input, updatedAt: new Date() },
    })
    .returning();
  if (!result) throw new Error('invoice_preferences_not_saved');
  return result;
}

export async function listStoredInvoices(
  db: Database,
  clerkUserId: string,
  input: { startDate: Date; endDateExclusive: Date; limit: number; cursor?: { receivedAt: Date; id: string } },
) {
  const cursorCondition = input.cursor
    ? or(
        lt(invoices.receivedAt, input.cursor.receivedAt),
        and(eq(invoices.receivedAt, input.cursor.receivedAt), lt(invoices.id, input.cursor.id)),
      )
    : undefined;
  return db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.clerkUserId, clerkUserId),
        gte(invoices.receivedAt, input.startDate),
        lt(invoices.receivedAt, input.endDateExclusive),
        cursorCondition,
      ),
    )
    .orderBy(desc(invoices.receivedAt), desc(invoices.id))
    .limit(input.limit);
}

export async function getInvoiceSyncState(db: Database, clerkUserId: string) {
  const [integration] = await db
    .select()
    .from(gmailIntegrations)
    .where(eq(gmailIntegrations.clerkUserId, clerkUserId))
    .limit(1);
  return integration ?? null;
}

export async function upsertGmailInvoice(
  db: Database,
  input: typeof invoices.$inferInsert,
) {
  await db
    .insert(invoices)
    .values(input)
    .onConflictDoUpdate({
      target: [invoices.clerkUserId, invoices.gmailMessageId],
      set: {
        gmailThreadId: input.gmailThreadId,
        vendor: input.vendor,
        invoiceNumber: input.invoiceNumber,
        amountMinor: input.amountMinor,
        currency: input.currency,
        dueDate: input.dueDate,
        receivedAt: input.receivedAt,
        description: input.description,
        hasAttachment: input.hasAttachment,
        confidence: input.confidence,
        updatedAt: new Date(),
      },
    });
}
