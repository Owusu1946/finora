import type { CreateMemoryInput, MemoryKind, UpdateMemoryInput } from '@finora/shared';
import { and, desc, eq, ilike, or } from 'drizzle-orm';

import type { Database } from './client';

import { aiMemorySettings, aiUserMemories } from './schema';

export function normalizeMemoryKey(value: string) {
  return value.trim().toLocaleLowerCase().replaceAll(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export async function getMemorySettings(db: Database, clerkUserId: string) {
  const [settings] = await db
    .select({ enabled: aiMemorySettings.enabled })
    .from(aiMemorySettings)
    .where(eq(aiMemorySettings.clerkUserId, clerkUserId))
    .limit(1);
  return { enabled: settings?.enabled ?? true };
}

export async function setMemoryEnabled(db: Database, clerkUserId: string, enabled: boolean) {
  const [settings] = await db
    .insert(aiMemorySettings)
    .values({ clerkUserId, enabled, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: aiMemorySettings.clerkUserId,
      set: { enabled, updatedAt: new Date() },
    })
    .returning({ enabled: aiMemorySettings.enabled });
  return { enabled: settings?.enabled ?? enabled };
}

export async function listUserMemories(
  db: Database,
  clerkUserId: string,
  input: { query?: string; kind?: MemoryKind; limit?: number } = {},
) {
  const filters = [eq(aiUserMemories.clerkUserId, clerkUserId)];
  if (input.kind) filters.push(eq(aiUserMemories.kind, input.kind));
  if (input.query) {
    const query = `%${input.query.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
    filters.push(or(ilike(aiUserMemories.title, query), ilike(aiUserMemories.content, query))!);
  }
  return db
    .select()
    .from(aiUserMemories)
    .where(and(...filters))
    .orderBy(desc(aiUserMemories.updatedAt))
    .limit(Math.min(input.limit ?? 20, 50));
}

export async function rememberUserMemory(
  db: Database,
  clerkUserId: string,
  input: CreateMemoryInput,
  source?: { chatId?: string; messageId?: string },
) {
  const normalizedKey = normalizeMemoryKey(input.title);
  const [memory] = await db
    .insert(aiUserMemories)
    .values({
      clerkUserId,
      ...input,
      normalizedKey,
      source: 'explicit',
      sourceChatId: source?.chatId,
      sourceMessageId: source?.messageId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [aiUserMemories.clerkUserId, aiUserMemories.kind, aiUserMemories.normalizedKey],
      set: {
        title: input.title,
        content: input.content,
        source: 'explicit',
        sourceChatId: source?.chatId,
        sourceMessageId: source?.messageId,
        updatedAt: new Date(),
      },
    })
    .returning();
  return memory!;
}

export async function updateUserMemory(
  db: Database,
  clerkUserId: string,
  input: UpdateMemoryInput,
) {
  const [existing] = await db
    .select()
    .from(aiUserMemories)
    .where(and(eq(aiUserMemories.id, input.id), eq(aiUserMemories.clerkUserId, clerkUserId)))
    .limit(1);
  if (!existing) return null;
  const title = input.title ?? existing.title;
  const kind = input.kind ?? existing.kind;
  const normalizedKey = normalizeMemoryKey(title);
  const [conflict] = await db
    .select({ id: aiUserMemories.id })
    .from(aiUserMemories)
    .where(
      and(
        eq(aiUserMemories.clerkUserId, clerkUserId),
        eq(aiUserMemories.kind, kind),
        eq(aiUserMemories.normalizedKey, normalizedKey),
      ),
    )
    .limit(1);
  if (conflict && conflict.id !== input.id) return null;
  const [updated] = await db
    .update(aiUserMemories)
    .set({
      kind,
      title,
      content: input.content ?? existing.content,
      normalizedKey,
      updatedAt: new Date(),
    })
    .where(and(eq(aiUserMemories.id, input.id), eq(aiUserMemories.clerkUserId, clerkUserId)))
    .returning();
  return updated ?? null;
}

export async function forgetUserMemory(db: Database, clerkUserId: string, id: string) {
  const [deleted] = await db
    .delete(aiUserMemories)
    .where(and(eq(aiUserMemories.id, id), eq(aiUserMemories.clerkUserId, clerkUserId)))
    .returning({ id: aiUserMemories.id });
  return deleted !== undefined;
}

export async function clearUserMemories(db: Database, clerkUserId: string) {
  const deleted = await db
    .delete(aiUserMemories)
    .where(eq(aiUserMemories.clerkUserId, clerkUserId))
    .returning({ id: aiUserMemories.id });
  return deleted.length;
}

function tokens(value: string) {
  const stopWords = new Set([
    'and', 'are', 'for', 'from', 'has', 'have', 'please', 'that', 'the', 'this', 'use', 'with',
  ]);
  return new Set(
    normalizeMemoryKey(value)
      .split(' ')
      .filter((token) => token.length >= 3 && !stopWords.has(token)),
  );
}

export function rankRelevantMemories<T extends { title: string; content: string }>(
  memories: T[],
  query: string,
  limit = 6,
) {
  const queryTokens = tokens(query);
  if (queryTokens.size === 0) return [];
  return memories
    .map((memory, index) => {
      const titleTokens = tokens(memory.title);
      const contentTokens = tokens(memory.content);
      let score = 0;
      for (const token of queryTokens) {
        if (titleTokens.has(token)) score += 3;
        if (contentTokens.has(token)) score += 1;
      }
      return { memory, score, index };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, limit)
    .map((item) => item.memory);
}

export async function findRelevantUserMemories(
  db: Database,
  clerkUserId: string,
  query: string,
) {
  const [settings, memories] = await Promise.all([
    getMemorySettings(db, clerkUserId),
    listUserMemories(db, clerkUserId, { limit: 50 }),
  ]);
  if (!settings.enabled) return [];
  return rankRelevantMemories(memories, query);
}

export function serializeMemory(memory: typeof aiUserMemories.$inferSelect) {
  return {
    id: memory.id,
    kind: memory.kind,
    title: memory.title,
    content: memory.content,
    source: 'explicit' as const,
    sourceChatId: memory.sourceChatId,
    createdAt: memory.createdAt.toISOString(),
    updatedAt: memory.updatedAt.toISOString(),
  };
}
