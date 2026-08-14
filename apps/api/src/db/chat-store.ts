import type { UIMessage } from 'ai';

import { and, asc, eq, getTableColumns, isNull, lt, or } from 'drizzle-orm';

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
  const rows = await db
    .select({ ...getTableColumns(aiChats), payload: aiChatMessages.payload })
    .from(aiChats)
    .leftJoin(aiChatMessages, eq(aiChatMessages.chatId, aiChats.id))
    .where(and(eq(aiChats.id, chatId), eq(aiChats.clerkUserId, clerkUserId)))
    .orderBy(asc(aiChatMessages.position));
  const first = rows[0];
  if (!first) return null;

  const { payload: _payload, ...chat } = first;
  return { ...chat, messages: rows.flatMap((row) => (row.payload ? [row.payload] : [])) };
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

export async function finalizeChatStream(
  db: Database,
  chatId: string,
  clerkUserId: string,
  streamId: string,
  messages: UIMessage[],
) {
  const messageRows = messages.map((message, position) => ({
    messageId: message.id,
    position,
    role: message.role === 'user' ? ('user' as const) : ('assistant' as const),
    payload: message,
  }));

  await db.$client.transaction((tx) => [
    tx.query(
      `select id from ai_chats
       where id = $1 and clerk_user_id = $2 and active_stream_id = $3
       for update`,
      [chatId, clerkUserId, streamId],
    ),
    tx.query(
      `delete from ai_chat_messages
       where chat_id in (
         select id from ai_chats
         where id = $1 and clerk_user_id = $2 and active_stream_id = $3
       )`,
      [chatId, clerkUserId, streamId],
    ),
    tx.query(
      `insert into ai_chat_messages (chat_id, message_id, position, role, payload)
       select
         chat.id,
         message.value ->> 'messageId',
         (message.value ->> 'position')::integer,
         (message.value ->> 'role')::ai_chat_message_role,
         message.value -> 'payload'
       from ai_chats as chat
       cross join jsonb_array_elements($4::jsonb) as message(value)
       where chat.id = $1 and chat.clerk_user_id = $2 and chat.active_stream_id = $3`,
      [chatId, clerkUserId, streamId, JSON.stringify(messageRows)],
    ),
    tx.query(
      `update ai_chats
       set active_stream_id = null,
           active_stream_started_at = null,
           active_stream_resumable = false,
           updated_at = now()
       where id = $1 and clerk_user_id = $2 and active_stream_id = $3`,
      [chatId, clerkUserId, streamId],
    ),
  ]);
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
