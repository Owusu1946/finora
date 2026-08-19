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
export const aiChatTitleStatusEnum = pgEnum('ai_chat_title_status', [
  'pending',
  'generated',
  'fallback',
]);
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
export const integrationStatusEnum = pgEnum('integration_status', [
  'connected',
  'syncing',
  'error',
  'reauthorization_required',
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
    title: text('title'),
    titleStatus: aiChatTitleStatusEnum('title_status').notNull().default('pending'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
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

export const oauthConnectionAttempts = pgTable(
  'oauth_connection_attempts',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    clerkUserId: text('clerk_user_id').notNull(),
    provider: text('provider').notNull(),
    stateHash: text('state_hash').notNull(),
    codeVerifierCiphertext: text('code_verifier_ciphertext').notNull(),
    returnUrl: text('return_url').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('oauth_connection_attempts_state_unique').on(table.stateHash),
    index('oauth_connection_attempts_user_index').on(table.clerkUserId, table.createdAt),
  ],
);

export const gmailIntegrations = pgTable(
  'gmail_integrations',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    clerkUserId: text('clerk_user_id').notNull(),
    googleSubject: text('google_subject').notNull(),
    email: text('email').notNull(),
    refreshTokenCiphertext: text('refresh_token_ciphertext').notNull(),
    scopes: jsonb('scopes').$type<string[]>().notNull(),
    status: integrationStatusEnum('status').notNull().default('connected'),
    historyId: text('history_id'),
    candidateCount: integer('candidate_count').notNull().default(0),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    lastErrorCode: text('last_error_code'),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('gmail_integrations_user_unique').on(table.clerkUserId),
    uniqueIndex('gmail_integrations_google_subject_unique').on(table.googleSubject),
    index('gmail_integrations_status_index').on(table.status),
  ],
);

export type GmailIntegrationRow = typeof gmailIntegrations.$inferSelect;

export const calendarIntegrations = pgTable(
  'calendar_integrations',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    clerkUserId: text('clerk_user_id').notNull(),
    googleSubject: text('google_subject').notNull(),
    email: text('email').notNull(),
    refreshTokenCiphertext: text('refresh_token_ciphertext').notNull(),
    scopes: jsonb('scopes').$type<string[]>().notNull(),
    status: integrationStatusEnum('status').notNull().default('connected'),
    syncToken: text('sync_token'),
    eventCount: integer('event_count').notNull().default(0),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    lastErrorCode: text('last_error_code'),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('calendar_integrations_user_unique').on(table.clerkUserId),
    uniqueIndex('calendar_integrations_google_subject_unique').on(table.googleSubject),
    index('calendar_integrations_status_index').on(table.status),
  ],
);

export const calendarMoneyEvents = pgTable(
  'calendar_money_events',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    clerkUserId: text('clerk_user_id').notNull(),
    integrationId: uuid('integration_id')
      .notNull()
      .references(() => calendarIntegrations.id, { onDelete: 'cascade' }),
    googleEventId: text('google_event_id').notNull(),
    title: text('title').notNull(),
    kind: text('kind').notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    amount: text('amount'),
    currency: text('currency'),
    counterparty: text('counterparty'),
    notes: text('notes'),
    sourceUrl: text('source_url'),
    etag: text('etag'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('calendar_money_events_user_event_unique').on(
      table.clerkUserId,
      table.googleEventId,
    ),
    index('calendar_money_events_user_due_index').on(table.clerkUserId, table.dueAt),
  ],
);

export const invoicePreferences = pgTable('invoice_preferences', {
  clerkUserId: text('clerk_user_id').primaryKey(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  timezone: text('timezone').notNull().default('UTC'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    clerkUserId: text('clerk_user_id').notNull(),
    gmailMessageId: text('gmail_message_id').notNull(),
    gmailThreadId: text('gmail_thread_id'),
    vendor: text('vendor').notNull(),
    invoiceNumber: text('invoice_number').notNull(),
    amountMinor: integer('amount_minor').notNull().default(0),
    currency: text('currency').notNull().default('USD'),
    dueDate: timestamp('due_date', { withTimezone: true }),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    status: text('status').notNull().default('due'),
    description: text('description'),
    hasAttachment: boolean('has_attachment').notNull().default(false),
    confidence: integer('confidence').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('invoices_user_gmail_message_unique').on(table.clerkUserId, table.gmailMessageId),
    index('invoices_user_received_index').on(table.clerkUserId, table.receivedAt),
  ],
);
