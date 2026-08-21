import { and, eq, lt, sql } from 'drizzle-orm';

import type { Database } from './client';

import { phoneVerificationChallenges } from './schema';

export async function savePhoneVerificationChallenge(
  db: Database,
  input: { clerkUserId: string; phoneNumber: string; codeHash: string; expiresAt: Date },
) {
  const [challenge] = await db
    .insert(phoneVerificationChallenges)
    .values({ ...input, attempts: 0, lastSentAt: new Date() })
    .onConflictDoUpdate({
      target: phoneVerificationChallenges.clerkUserId,
      set: {
        phoneNumber: input.phoneNumber,
        codeHash: input.codeHash,
        expiresAt: input.expiresAt,
        attempts: 0,
        lastSentAt: new Date(),
      },
    })
    .returning({ id: phoneVerificationChallenges.id });

  if (!challenge) throw new Error('Phone verification challenge was not saved.');
  return challenge.id;
}

export async function getPhoneVerificationChallenge(db: Database, clerkUserId: string) {
  const [challenge] = await db
    .select()
    .from(phoneVerificationChallenges)
    .where(eq(phoneVerificationChallenges.clerkUserId, clerkUserId))
    .limit(1);
  return challenge ?? null;
}

export async function consumePhoneVerificationAttempt(db: Database, clerkUserId: string) {
  const [challenge] = await db
    .update(phoneVerificationChallenges)
    .set({ attempts: sql`${phoneVerificationChallenges.attempts} + 1` })
    .where(
      and(
        eq(phoneVerificationChallenges.clerkUserId, clerkUserId),
        lt(phoneVerificationChallenges.attempts, 5),
      ),
    )
    .returning();
  return challenge ?? null;
}

export async function deletePhoneVerificationChallenge(db: Database, id: string) {
  await db.delete(phoneVerificationChallenges).where(eq(phoneVerificationChallenges.id, id));
}
