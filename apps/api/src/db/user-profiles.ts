import type { UserProfile } from '@finora/shared';

import { and, asc, eq, ilike, isNotNull, ne, or, sql } from 'drizzle-orm';

import type { Database } from './client';

import { userProfiles, type UserProfileRow } from './schema';

export type ClerkProfileInput = {
  clerkUserId: string;
  email: string;
  displayName: string;
  imageUrl: string | null;
  accountType?: 'personal' | 'business';
  finoraTag?: string;
};

function serializeProfile(row: UserProfileRow): UserProfile {
  return {
    ...row,
    phoneVerifiedAt: row.phoneVerifiedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function upsertUserProfile(db: Database, input: ClerkProfileInput) {
  const [row] = await db
    .insert(userProfiles)
    .values(input)
    .onConflictDoUpdate({
      target: userProfiles.clerkUserId,
      set: {
        email: input.email,
        displayName: input.displayName,
        imageUrl: input.imageUrl,
        ...(input.accountType !== undefined ? { accountType: input.accountType } : {}),
        ...(input.finoraTag !== undefined ? { finoraTag: input.finoraTag } : {}),
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!row) throw new Error('User profile upsert did not return a row.');
  return serializeProfile(row);
}

export async function getUserProfileByClerkId(db: Database, clerkUserId: string) {
  const [row] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.clerkUserId, clerkUserId))
    .limit(1);
  return row ? serializeProfile(row) : null;
}

export async function getUserProfileByPhoneNumber(db: Database, phoneNumber: string) {
  const [row] = await db
    .select({ clerkUserId: userProfiles.clerkUserId })
    .from(userProfiles)
    .where(eq(userProfiles.phoneNumber, phoneNumber))
    .limit(1);
  return row ?? null;
}

export async function searchUserProfilesByFinoraTag(
  db: Database,
  clerkUserId: string,
  query: string,
  limit = 6,
) {
  return db
    .select({
      id: userProfiles.id,
      displayName: userProfiles.displayName,
      finoraTag: userProfiles.finoraTag,
    })
    .from(userProfiles)
    .where(
      and(
        ne(userProfiles.clerkUserId, clerkUserId),
        isNotNull(userProfiles.finoraTag),
        or(
          ilike(userProfiles.finoraTag, `${query}%`),
          ilike(userProfiles.displayName, `%${query}%`),
        ),
      ),
    )
    .orderBy(
      sql`case when ${userProfiles.finoraTag} = ${query} then 0 when ${userProfiles.finoraTag} ilike ${`${query}%`} then 1 else 2 end`,
      asc(userProfiles.displayName),
    )
    .limit(Math.min(Math.max(limit, 1), 12));
}

export async function setVerifiedPhoneNumber(
  db: Database,
  clerkUserId: string,
  phoneNumber: string,
) {
  const [row] = await db
    .update(userProfiles)
    .set({ phoneNumber, phoneVerifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(userProfiles.clerkUserId, clerkUserId))
    .returning();

  if (!row) throw new Error('User profile was not found while verifying the phone number.');
  return serializeProfile(row);
}
