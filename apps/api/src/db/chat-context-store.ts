import { and, eq } from 'drizzle-orm';

import type { Database } from './client';

import { aiChatContexts, aiChats } from './schema';

export type StoredChatContext = typeof aiChatContexts.$inferSelect;

export async function getChatContext(db: Database, chatId: string, clerkUserId: string) {
  const [context] = await db
    .select({
      chatId: aiChatContexts.chatId,
      summary: aiChatContexts.summary,
      summarizedThroughPosition: aiChatContexts.summarizedThroughPosition,
      summarizedThroughMessageId: aiChatContexts.summarizedThroughMessageId,
      sourceMessageCount: aiChatContexts.sourceMessageCount,
      version: aiChatContexts.version,
      createdAt: aiChatContexts.createdAt,
      updatedAt: aiChatContexts.updatedAt,
    })
    .from(aiChatContexts)
    .innerJoin(aiChats, eq(aiChats.id, aiChatContexts.chatId))
    .where(and(eq(aiChatContexts.chatId, chatId), eq(aiChats.clerkUserId, clerkUserId)))
    .limit(1);
  return context ?? null;
}

export async function saveChatContext(
  db: Database,
  clerkUserId: string,
  input: {
    chatId: string;
    summary: string;
    summarizedThroughPosition: number;
    summarizedThroughMessageId: string;
    sourceMessageCount: number;
  },
) {
  const [ownedChat] = await db
    .select({ id: aiChats.id })
    .from(aiChats)
    .where(and(eq(aiChats.id, input.chatId), eq(aiChats.clerkUserId, clerkUserId)))
    .limit(1);
  if (!ownedChat) return false;

  await db
    .insert(aiChatContexts)
    .values({ ...input, version: 1, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: aiChatContexts.chatId,
      set: {
        summary: input.summary,
        summarizedThroughPosition: input.summarizedThroughPosition,
        summarizedThroughMessageId: input.summarizedThroughMessageId,
        sourceMessageCount: input.sourceMessageCount,
        version: 1,
        updatedAt: new Date(),
      },
    });
  return true;
}
