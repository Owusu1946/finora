import type { UIMessage } from 'ai';

import { and, asc, eq, isNull, lt, or } from 'drizzle-orm';

import type { Database } from './client';

import { aiChatMessages, aiChats } from './schema';

const ACTIVE_STREAM_STALE_MS = 5 * 60_000;

export async function ensureChat(db: Database, chatId: string, clerkUserId: string) {
  const [created] = await db
    .insert(aiChats)
    .values({ id: chatId, clerkUserId })
    .onConflictDoNothing()
    .returning({ clerkUserId: aiChats.clerkUserId });
  if (created) return true;

  const [existing] = await db
    .select({ clerkUserId: aiChats.clerkUserId })
    .from(aiChats)
    .where(eq(aiChats.id, chatId))
    .limit(1);
  return existing?.clerkUserId === clerkUserId;
}

export async function loadChat(db: Database, chatId: string, clerkUserId: string) {
  const [chat] = await db
    .select()
    .from(aiChats)
    .where(and(eq(aiChats.id, chatId), eq(aiChats.clerkUserId, clerkUserId)))
    .limit(1);
  if (!chat) return null;

  const rows = await db
    .select({ payload: aiChatMessages.payload })
    .from(aiChatMessages)
    .where(eq(aiChatMessages.chatId, chatId))
    .orderBy(asc(aiChatMessages.position));

  return { ...chat, messages: rows.map((row) => row.payload) };
}

export async function claimChatStream(
  db: Database,
  chatId: string,
  clerkUserId: string,
  streamId: string,
  resumable: boolean,
) {
  const staleBefore = new Date(Date.now() - ACTIVE_STREAM_STALE_MS);
  const [claimed] = await db
    .update(aiChats)
    .set({
      activeStreamId: streamId,
      activeStreamStartedAt: new Date(),
      activeStreamResumable: resumable,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(aiChats.id, chatId),
        eq(aiChats.clerkUserId, clerkUserId),
        or(
          isNull(aiChats.activeStreamId),
          isNull(aiChats.activeStreamStartedAt),
          lt(aiChats.activeStreamStartedAt, staleBefore),
        ),
      ),
    )
    .returning({ id: aiChats.id });
  return claimed !== undefined;
}

export async function clearChatStream(
  db: Database,
  chatId: string,
  clerkUserId: string,
  streamId: string,
) {
  await db
    .update(aiChats)
    .set({
      activeStreamId: null,
      activeStreamStartedAt: null,
      activeStreamResumable: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(aiChats.id, chatId),
        eq(aiChats.clerkUserId, clerkUserId),
        eq(aiChats.activeStreamId, streamId),
      ),
    );
}

export async function replaceChatMessages(
  db: Database,
  chatId: string,
  clerkUserId: string,
  messages: UIMessage[],
) {
  const deleteMessages = db.delete(aiChatMessages).where(eq(aiChatMessages.chatId, chatId));
  const touchChat = db
    .update(aiChats)
    .set({ updatedAt: new Date() })
    .where(and(eq(aiChats.id, chatId), eq(aiChats.clerkUserId, clerkUserId)));

  if (messages.length === 0) {
    await db.batch([deleteMessages, touchChat]);
    return;
  }

  const insertMessages = db.insert(aiChatMessages).values(
    messages.map((message, position) => ({
      chatId,
      messageId: message.id,
      position,
      role: message.role === 'user' ? ('user' as const) : ('assistant' as const),
      payload: message,
    })),
  );
  await db.batch([deleteMessages, insertMessages, touchChat]);
}

export function chatIsActive(chat: {
  activeStreamId: string | null;
  activeStreamStartedAt: Date | null;
}) {
  return (
    chat.activeStreamId !== null &&
    chat.activeStreamStartedAt !== null &&
    chat.activeStreamStartedAt.getTime() > Date.now() - ACTIVE_STREAM_STALE_MS
  );
}
