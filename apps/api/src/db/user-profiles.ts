import type { UserProfile } from '@finora/shared';

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
