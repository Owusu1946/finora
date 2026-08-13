import { and, eq, lt, sql } from 'drizzle-orm';

import type { Database } from './client';

import { passcodeRecoveryChallenges } from './schema';

export async function saveRecoveryChallenge(
  db: Database,
  input: { clerkUserId: string; codeHash: string; expiresAt: Date },
) {
  const [challenge] = await db
    .insert(passcodeRecoveryChallenges)
    .values({ ...input, attempts: 0, lastSentAt: new Date(), verifiedAt: null })
    .onConflictDoUpdate({
      target: passcodeRecoveryChallenges.clerkUserId,
      set: {
        codeHash: input.codeHash,
        expiresAt: input.expiresAt,
        attempts: 0,
        lastSentAt: new Date(),
        verifiedAt: null,
      },
    })
    .returning({ id: passcodeRecoveryChallenges.id });

  if (!challenge) throw new Error('Recovery challenge was not saved.');
  return challenge.id;
}

export async function getActiveRecoveryChallenge(db: Database, clerkUserId: string) {
  const [challenge] = await db
    .select()
    .from(passcodeRecoveryChallenges)
    .where(eq(passcodeRecoveryChallenges.clerkUserId, clerkUserId))
    .limit(1);
  return challenge ?? null;
}

export async function consumeRecoveryAttempt(db: Database, clerkUserId: string) {
  const [challenge] = await db
    .update(passcodeRecoveryChallenges)
    .set({ attempts: sql`${passcodeRecoveryChallenges.attempts} + 1` })
    .where(
      and(
        eq(passcodeRecoveryChallenges.clerkUserId, clerkUserId),
        lt(passcodeRecoveryChallenges.attempts, 5),
      ),
    )
    .returning();
  if (!challenge) return null;

  return challenge;
}

export async function markRecoveryVerified(db: Database, id: string) {
  const [challenge] = await db
    .update(passcodeRecoveryChallenges)
    .set({ verifiedAt: new Date() })
    .where(eq(passcodeRecoveryChallenges.id, id))
    .returning({ id: passcodeRecoveryChallenges.id });
  return challenge ?? null;
}

export async function deleteRecoveryChallenge(db: Database, id: string) {
  await db.delete(passcodeRecoveryChallenges).where(eq(passcodeRecoveryChallenges.id, id));
}
