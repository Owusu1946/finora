import { and, eq, gt, isNull } from 'drizzle-orm';

import type { Database } from './client';

import { calendarIntegrations, calendarMoneyEvents, oauthConnectionAttempts } from './schema';

export async function createCalendarOAuthAttempt(
  db: Database,
  input: {
    clerkUserId: string;
    stateHash: string;
    codeVerifierCiphertext: string;
    returnUrl: string;
    expiresAt: Date;
  },
) {
  const [attempt] = await db
    .insert(oauthConnectionAttempts)
    .values({ ...input, provider: 'calendar' })
    .returning();
  if (!attempt) throw new Error('OAuth connection attempt was not created.');
  return attempt;
}

export async function consumeCalendarOAuthAttempt(db: Database, stateHash: string) {
  const [attempt] = await db
    .update(oauthConnectionAttempts)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(oauthConnectionAttempts.provider, 'calendar'),
        eq(oauthConnectionAttempts.stateHash, stateHash),
        isNull(oauthConnectionAttempts.consumedAt),
        gt(oauthConnectionAttempts.expiresAt, new Date()),
      ),
    )
    .returning();
  return attempt ?? null;
}

export async function getCalendarIntegration(db: Database, clerkUserId: string) {
  const [integration] = await db
    .select()
    .from(calendarIntegrations)
    .where(eq(calendarIntegrations.clerkUserId, clerkUserId))
    .limit(1);
  return integration ?? null;
}

export async function getCalendarIntegrationById(db: Database, id: string) {
  const [integration] = await db
    .select()
    .from(calendarIntegrations)
    .where(eq(calendarIntegrations.id, id))
    .limit(1);
  return integration ?? null;
}

export async function upsertCalendarIntegration(
  db: Database,
  input: {
    clerkUserId: string;
    googleSubject: string;
    email: string;
    refreshTokenCiphertext: string;
    scopes: string[];
  },
) {
  const [integration] = await db
    .insert(calendarIntegrations)
    .values(input)
    .onConflictDoUpdate({
      target: calendarIntegrations.clerkUserId,
      set: {
        googleSubject: input.googleSubject,
        email: input.email,
        refreshTokenCiphertext: input.refreshTokenCiphertext,
        scopes: input.scopes,
        status: 'connected',
        revokedAt: null,
        lastErrorCode: null,
        updatedAt: new Date(),
      },
    })
    .returning();
  if (!integration) throw new Error('Calendar integration was not saved.');
  return integration;
}

export async function markCalendarSyncing(db: Database, id: string) {
  await db
    .update(calendarIntegrations)
    .set({ status: 'syncing', lastErrorCode: null, updatedAt: new Date() })
    .where(eq(calendarIntegrations.id, id));
}

export async function markCalendarSynced(
  db: Database,
  id: string,
  input: { syncToken?: string; eventCount: number },
) {
  await db
    .update(calendarIntegrations)
    .set({
      status: 'connected',
      syncToken: input.syncToken,
      eventCount: input.eventCount,
      lastSyncedAt: new Date(),
      lastErrorCode: null,
      updatedAt: new Date(),
    })
    .where(eq(calendarIntegrations.id, id));
}

export async function markCalendarSyncFailed(
  db: Database,
  id: string,
  errorCode: string,
  reauthorizationRequired = false,
) {
  await db
    .update(calendarIntegrations)
    .set({
      status: reauthorizationRequired ? 'reauthorization_required' : 'error',
      lastErrorCode: errorCode,
      updatedAt: new Date(),
    })
    .where(eq(calendarIntegrations.id, id));
}

export async function clearCalendarSyncToken(db: Database, id: string) {
  await db
    .update(calendarIntegrations)
    .set({ syncToken: null, status: 'connected', updatedAt: new Date() })
    .where(eq(calendarIntegrations.id, id));
}

export async function revokeCalendarIntegration(db: Database, clerkUserId: string) {
  const [integration] = await db
    .update(calendarIntegrations)
    .set({
      status: 'error',
      revokedAt: new Date(),
      lastErrorCode: 'disconnected',
      updatedAt: new Date(),
    })
    .where(eq(calendarIntegrations.clerkUserId, clerkUserId))
    .returning();
  return integration ?? null;
}

export async function upsertCalendarMoneyEvent(
  db: Database,
  input: {
    clerkUserId: string;
    integrationId: string;
    googleEventId: string;
    title: string;
    kind: string;
    dueAt: Date;
    amount?: string | null;
    currency?: string | null;
    counterparty?: string | null;
    notes?: string | null;
    sourceUrl?: string | null;
    etag?: string | null;
  },
) {
  const [event] = await db
    .insert(calendarMoneyEvents)
    .values(input)
    .onConflictDoUpdate({
      target: [calendarMoneyEvents.clerkUserId, calendarMoneyEvents.googleEventId],
      set: { ...input, updatedAt: new Date(), cancelledAt: null },
    })
    .returning();
  return event;
}

export async function cancelCalendarMoneyEvent(
  db: Database,
  clerkUserId: string,
  googleEventId: string,
) {
  await db
    .update(calendarMoneyEvents)
    .set({ cancelledAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(calendarMoneyEvents.clerkUserId, clerkUserId),
        eq(calendarMoneyEvents.googleEventId, googleEventId),
      ),
    );
}

export async function listCalendarMoneyEvents(db: Database, clerkUserId: string) {
  return db
    .select()
    .from(calendarMoneyEvents)
    .where(
      and(
        eq(calendarMoneyEvents.clerkUserId, clerkUserId),
        isNull(calendarMoneyEvents.cancelledAt),
      ),
    )
    .orderBy(calendarMoneyEvents.dueAt)
    .limit(100);
}
