import { sql } from 'drizzle-orm';
import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const accountTypeEnum = pgEnum('account_type', ['personal', 'business']);

export const userProfiles = pgTable(
  'user_profiles',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    clerkUserId: text('clerk_user_id').notNull(),
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    imageUrl: text('image_url'),
    accountType: accountTypeEnum('account_type'),
    finoraTag: text('finora_tag'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('user_profiles_clerk_user_id_unique').on(table.clerkUserId),
    uniqueIndex('user_profiles_finora_tag_unique').on(table.finoraTag),
    index('user_profiles_email_index').on(table.email),
  ],
);

export type UserProfileRow = typeof userProfiles.$inferSelect;
