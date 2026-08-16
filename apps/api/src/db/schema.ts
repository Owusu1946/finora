import type { UIMessage } from 'ai';

import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const accountTypeEnum = pgEnum('account_type', ['personal', 'business']);
export const aiChatMessageRoleEnum = pgEnum('ai_chat_message_role', ['user', 'assistant']);
export const transactionalEmailStatusEnum = pgEnum('transactional_email_status', [
  'queued',
  'sending',
  'sent',
  'delivered',
  'delayed',
  'bounced',
  'complained',
  'suppressed',
  'failed',
]);

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
    phoneNumber: text('phone_number'),
    phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('user_profiles_clerk_user_id_unique').on(table.clerkUserId),
    uniqueIndex('user_profiles_finora_tag_unique').on(table.finoraTag),
    uniqueIndex('user_profiles_phone_number_unique').on(table.phoneNumber),
    index('user_profiles_email_index').on(table.email),
  ],
);

export type UserProfileRow = typeof userProfiles.$inferSelect;

export const passcodeRecoveryChallenges = pgTable(
  'passcode_recovery_challenges',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    clerkUserId: text('clerk_user_id').notNull(),
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    lastSentAt: timestamp('last_sent_at', { withTimezone: true }).notNull().defaultNow(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('passcode_recovery_challenges_user_unique').on(table.clerkUserId)],
);

export const phoneVerificationChallenges = pgTable(
  'phone_verification_challenges',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    clerkUserId: text('clerk_user_id').notNull(),
    phoneNumber: text('phone_number').notNull(),
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    lastSentAt: timestamp('last_sent_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('phone_verification_challenges_user_unique').on(table.clerkUserId)],
);

export const aiChats = pgTable(
  'ai_chats',
  {
    id: text('id').primaryKey(),
    clerkUserId: text('clerk_user_id').notNull(),
    activeStreamId: text('active_stream_id'),
    activeStreamStartedAt: timestamp('active_stream_started_at', { withTimezone: true }),
    activeStreamResumable: boolean('active_stream_resumable').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ai_chats_clerk_user_updated_index').on(table.clerkUserId, table.updatedAt),
    uniqueIndex('ai_chats_active_stream_unique').on(table.activeStreamId),
  ],
);

export const aiChatMessages = pgTable(
  'ai_chat_messages',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    chatId: text('chat_id')
      .notNull()
      .references(() => aiChats.id, { onDelete: 'cascade' }),
    messageId: text('message_id').notNull(),
    position: integer('position').notNull(),
    role: aiChatMessageRoleEnum('role').notNull(),
    payload: jsonb('payload').$type<UIMessage>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('ai_chat_messages_chat_message_unique').on(table.chatId, table.messageId),
    uniqueIndex('ai_chat_messages_chat_position_unique').on(table.chatId, table.position),
  ],
);

export const transactionalEmailDeliveries = pgTable(
  'transactional_email_deliveries',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    clerkUserId: text('clerk_user_id').notNull(),
    recipientEmail: text('recipient_email').notNull(),
    recipientName: text('recipient_name'),
    emailKind: text('email_kind').notNull(),
    status: transactionalEmailStatusEnum('status').notNull().default('queued'),
    resendEmailId: text('resend_email_id'),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastErrorCode: text('last_error_code'),
    queuedAt: timestamp('queued_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('transactional_email_deliveries_user_kind_unique').on(
      table.clerkUserId,
      table.emailKind,
    ),
    uniqueIndex('transactional_email_deliveries_resend_id_unique').on(table.resendEmailId),
    index('transactional_email_deliveries_status_index').on(table.status),
  ],
);

export type TransactionalEmailDeliveryRow = typeof transactionalEmailDeliveries.$inferSelect;
