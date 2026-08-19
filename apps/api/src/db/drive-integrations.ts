import { eq } from 'drizzle-orm';

import type { Database } from './client';
import { driveIntegrations } from './schema';

export async function getDriveIntegration(db: Database, clerkUserId: string) {
  const [integration] = await db.select().from(driveIntegrations).where(eq(driveIntegrations.clerkUserId, clerkUserId)).limit(1);
  return integration ?? null;
}

export async function upsertDriveIntegration(db: Database, input: { clerkUserId: string; googleSubject: string; email: string; refreshTokenCiphertext: string; scopes: string[] }) {
  const [integration] = await db.insert(driveIntegrations).values(input).onConflictDoUpdate({
    target: driveIntegrations.clerkUserId,
    set: { googleSubject: input.googleSubject, email: input.email, refreshTokenCiphertext: input.refreshTokenCiphertext, scopes: input.scopes, status: 'connected', revokedAt: null, lastErrorCode: null, updatedAt: new Date() },
  }).returning();
  if (!integration) throw new Error('Drive integration was not saved.');
  return integration;
}

export async function revokeDriveIntegration(db: Database, clerkUserId: string) {
  await db.update(driveIntegrations).set({ status: 'error', revokedAt: new Date(), lastErrorCode: 'disconnected', updatedAt: new Date() }).where(eq(driveIntegrations.clerkUserId, clerkUserId));
}
