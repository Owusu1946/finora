import { and, desc, eq } from 'drizzle-orm';

import type { Database } from './client';

import { virtualCards } from './schema';

export type VirtualCardRow = typeof virtualCards.$inferSelect;

export async function insertVirtualCard(
  db: Database,
  input: { id: string; clerkUserId: string; providerCardToken: string; label: string },
) {
  const [row] = await db.insert(virtualCards).values(input).returning();
  return row!;
}

export async function listVirtualCardRows(db: Database, clerkUserId: string) {
  return db
    .select()
    .from(virtualCards)
    .where(eq(virtualCards.clerkUserId, clerkUserId))
    .orderBy(desc(virtualCards.createdAt));
}

/** Always scoped to the owner, so one user can never reach another's card. */
export async function getVirtualCardRow(db: Database, clerkUserId: string, id: string) {
  const [row] = await db
    .select()
    .from(virtualCards)
    .where(and(eq(virtualCards.id, id), eq(virtualCards.clerkUserId, clerkUserId)))
    .limit(1);
  return row ?? null;
}

export async function updateVirtualCardRow(
  db: Database,
  clerkUserId: string,
  id: string,
  patch: { label?: string; closedAt?: Date },
) {
  const [row] = await db
    .update(virtualCards)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(virtualCards.id, id), eq(virtualCards.clerkUserId, clerkUserId)))
    .returning();
  return row ?? null;
}
