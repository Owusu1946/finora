import type { CreateMemoryInput, MemoryKind, UpdateMemoryInput } from '@finora/shared';

import {
  and,
  asc,
  cosineDistance,
  desc,
  eq,
  ilike,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
} from 'drizzle-orm';

import type { Database } from './client';

import { isMemoryEmbeddingCompatible, MEMORY_EMBEDDING_DIMENSIONS } from '../ai/memory-contract';
import { aiMemorySettings, aiUserMemories } from './schema';

const SEMANTIC_DISTANCE_THRESHOLD = 0.45;

export function normalizeMemoryKey(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .replaceAll(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
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
  embedding?: { values: number[]; model: string },
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
      embedding: embedding?.values,
      embeddingModel: embedding?.model,
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
        embedding: embedding?.values ?? null,
        embeddingModel: embedding?.model ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();
  return memory!;
}

export async function setMemoryEmbedding(
  db: Database,
  clerkUserId: string,
  id: string,
  embedding: { values: number[]; model: string },
  expectedUpdatedAt: Date,
) {
  const [updated] = await db
    .update(aiUserMemories)
    .set({ embedding: embedding.values, embeddingModel: embedding.model })
    .where(
      and(
        eq(aiUserMemories.id, id),
        eq(aiUserMemories.clerkUserId, clerkUserId),
        eq(aiUserMemories.updatedAt, expectedUpdatedAt),
      ),
    )
    .returning({ id: aiUserMemories.id });
  return updated !== undefined;
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
      embedding: null,
      embeddingModel: null,
      updatedAt: new Date(),
    })
    .where(and(eq(aiUserMemories.id, input.id), eq(aiUserMemories.clerkUserId, clerkUserId)))
    .returning();
  return updated ?? null;
}

export function listMemoriesMissingEmbeddings(
  db: Database,
  clerkUserId: string,
  limit = 5,
  embeddingModel?: string,
) {
  return db
    .select({
      id: aiUserMemories.id,
      kind: aiUserMemories.kind,
      title: aiUserMemories.title,
      content: aiUserMemories.content,
      updatedAt: aiUserMemories.updatedAt,
    })
    .from(aiUserMemories)
    .where(
      and(
        eq(aiUserMemories.clerkUserId, clerkUserId),
        embeddingModel
          ? or(
              isNull(aiUserMemories.embedding),
              isNull(aiUserMemories.embeddingModel),
              ne(aiUserMemories.embeddingModel, embeddingModel),
            )
          : isNull(aiUserMemories.embedding),
      ),
    )
    .orderBy(desc(aiUserMemories.updatedAt))
    .limit(Math.min(Math.max(limit, 1), 10));
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
    'and',
    'are',
    'for',
    'from',
    'has',
    'have',
    'please',
    'that',
    'the',
    'this',
    'use',
    'with',
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

export function rankHybridMemories<T extends { id: string; title: string; content: string }>(
  memories: T[],
  query: string,
  semantic: { id: string; distance: number }[],
  limit = 6,
) {
  const lexical = rankRelevantMemories(memories, query, limit);
  const lexicalRanks = new Map(lexical.map((memory, index) => [memory.id, index]));
  const semanticDistances = new Map(
    semantic
      .filter(
        (item) => Number.isFinite(item.distance) && item.distance < SEMANTIC_DISTANCE_THRESHOLD,
      )
      .map((item) => [item.id, item.distance]),
  );
  return memories
    .map((memory, index) => {
      const distance = semanticDistances.get(memory.id);
      const lexicalRank = lexicalRanks.get(memory.id);
      const semanticScore = distance === undefined ? 0 : (1 - distance) * 2;
      const lexicalScore =
        lexicalRank === undefined ? 0 : 1 - lexicalRank / Math.max(lexical.length, 1);
      return { memory, score: semanticScore + lexicalScore, index };
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
  queryEmbedding?:
    | { values: number[]; model: string }
    | null
    | Promise<{ values: number[]; model: string } | null>
    | (() => Promise<{ values: number[]; model: string } | null>),
) {
  const startedAt = Date.now();
  const settings = await getMemorySettings(db, clerkUserId);
  if (!settings.enabled) {
    console.info('[memory:retrieval]', { mode: 'disabled', latencyMs: Date.now() - startedAt });
    return [];
  }
  const [memories, resolvedEmbedding] = await Promise.all([
    listUserMemories(db, clerkUserId, { limit: 50 }),
    typeof queryEmbedding === 'function' ? queryEmbedding() : queryEmbedding,
  ]);
  if (!resolvedEmbedding || !isMemoryEmbeddingCompatible(resolvedEmbedding.values)) {
    if (resolvedEmbedding) {
      console.warn('[memory:semantic-retrieval-skipped]', {
        reason: 'embedding_dimension_mismatch',
        expectedDimensions: MEMORY_EMBEDDING_DIMENSIONS,
        receivedDimensions: resolvedEmbedding.values.length,
      });
    }
    const results = rankRelevantMemories(memories, query);
    console.info('[memory:retrieval]', {
      mode: 'lexical_fallback',
      candidateCount: memories.length,
      resultCount: results.length,
      latencyMs: Date.now() - startedAt,
    });
    return results;
  }
  try {
    const distance = cosineDistance(aiUserMemories.embedding, resolvedEmbedding.values);
    const semantic = await db
      .select({ id: aiUserMemories.id, distance })
      .from(aiUserMemories)
      .where(
        and(
          eq(aiUserMemories.clerkUserId, clerkUserId),
          eq(aiUserMemories.embeddingModel, resolvedEmbedding.model),
          isNotNull(aiUserMemories.embedding),
          lt(distance, SEMANTIC_DISTANCE_THRESHOLD),
        ),
      )
      .orderBy(asc(distance))
      .limit(12);
    const results = rankHybridMemories(
      memories,
      query,
      semantic.map((item) => ({ id: item.id, distance: Number(item.distance) })),
    );
    console.info('[memory:retrieval]', {
      mode: 'hybrid',
      candidateCount: memories.length,
      semanticCount: semantic.length,
      resultCount: results.length,
      embeddingModel: resolvedEmbedding.model,
      latencyMs: Date.now() - startedAt,
    });
    return results;
  } catch (error) {
    console.error('[memory:semantic-retrieval]', {
      errorName: error instanceof Error ? error.name : typeof error,
    });
    const results = rankRelevantMemories(memories, query);
    console.info('[memory:retrieval]', {
      mode: 'lexical_fallback',
      reason: 'semantic_query_failed',
      candidateCount: memories.length,
      resultCount: results.length,
      latencyMs: Date.now() - startedAt,
    });
    return results;
  }
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
