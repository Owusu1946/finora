import { and, eq, gt, isNull } from 'drizzle-orm';

import type { Database } from './client';

import { gmailIntegrations, oauthConnectionAttempts } from './schema';

export async function createGmailOAuthAttempt(
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
    .values({ ...input, provider: 'gmail' })
    .returning();
  if (!attempt) throw new Error('OAuth connection attempt was not created.');
  return attempt;
}

export async function consumeGmailOAuthAttempt(db: Database, stateHash: string) {
  const [attempt] = await db
    .update(oauthConnectionAttempts)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(oauthConnectionAttempts.provider, 'gmail'),
        eq(oauthConnectionAttempts.stateHash, stateHash),
        isNull(oauthConnectionAttempts.consumedAt),
        gt(oauthConnectionAttempts.expiresAt, new Date()),
      ),
    )
    .returning();
  return attempt ?? null;
}

export async function getGmailIntegration(db: Database, clerkUserId: string) {
  const [integration] = await db
    .select()
    .from(gmailIntegrations)
    .where(eq(gmailIntegrations.clerkUserId, clerkUserId))
    .limit(1);
  return integration ?? null;
}

export async function getGmailIntegrationById(db: Database, id: string) {
  const [integration] = await db
    .select()
    .from(gmailIntegrations)
    .where(eq(gmailIntegrations.id, id))
    .limit(1);
  return integration ?? null;
}

export async function upsertGmailIntegration(
  db: Database,
  input: {
    clerkUserId: string;
    googleSubject: string;
    email: string;
    refreshTokenCiphertext: string;
    scopes: string[];
    historyId?: string;
  },
) {
  const [integration] = await db
    .insert(gmailIntegrations)
    .values(input)
    .onConflictDoUpdate({
      target: gmailIntegrations.clerkUserId,
      set: {
        googleSubject: input.googleSubject,
        email: input.email,
        refreshTokenCiphertext: input.refreshTokenCiphertext,
        scopes: input.scopes,
        historyId: input.historyId,
        status: 'connected',
        revokedAt: null,
        lastErrorCode: null,
        updatedAt: new Date(),
      },
    })
    .returning();
  if (!integration) throw new Error('Gmail integration was not saved.');
  return integration;
}

export async function markGmailSyncing(db: Database, id: string) {
  await db
    .update(gmailIntegrations)
    .set({ status: 'syncing', lastErrorCode: null, updatedAt: new Date() })
    .where(eq(gmailIntegrations.id, id));
}

export async function markGmailSynced(
  db: Database,
  id: string,
  input: { historyId?: string; candidateCount: number },
) {
  await db
    .update(gmailIntegrations)
    .set({
      status: 'connected',
      historyId: input.historyId,
      candidateCount: input.candidateCount,
      lastSyncedAt: new Date(),
      lastErrorCode: null,
      updatedAt: new Date(),
    })
    .where(eq(gmailIntegrations.id, id));
}

export async function markGmailSyncFailed(
  db: Database,
  id: string,
  errorCode: string,
  reauthorizationRequired = false,
) {
  await db
    .update(gmailIntegrations)
    .set({
      status: reauthorizationRequired ? 'reauthorization_required' : 'error',
      lastErrorCode: errorCode,
      updatedAt: new Date(),
    })
    .where(eq(gmailIntegrations.id, id));
}

export async function revokeGmailIntegration(db: Database, clerkUserId: string) {
  const [integration] = await db
    .update(gmailIntegrations)
    .set({
      status: 'error',
      revokedAt: new Date(),
      lastErrorCode: 'disconnected',
      updatedAt: new Date(),
    })
    .where(eq(gmailIntegrations.clerkUserId, clerkUserId))
    .returning();
  return integration ?? null;
}
