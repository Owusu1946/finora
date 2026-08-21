import type { MemoryKind } from '@finora/shared';

import { createOpenAI } from '@ai-sdk/openai';
import { embed, embedMany } from 'ai';

import type { Database } from '../db/client';

import {
  getMemorySettings,
  listMemoriesMissingEmbeddings,
  setMemoryEmbedding,
} from '../db/memory-store';

const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1_536;
const EMBEDDING_TIMEOUT_MS = 8_000;
const QUERY_EMBEDDING_TIMEOUT_MS = 1_000;
const BACKFILL_LIMIT = 5;

type MemoryEmbeddingEnvironment = {
  MEMORY_EMBEDDING_API_KEY?: string;
  MEMORY_EMBEDDING_MODEL?: string;
  OPENAI_API_KEY?: string;
};

type EmbeddableMemory = {
  id: string;
  kind: MemoryKind;
  title: string;
  content: string;
  updatedAt: Date;
};

export type MemoryEmbedding = {
  values: number[];
  model: string;
};

export function getMemoryEmbeddingConfig(env: MemoryEmbeddingEnvironment) {
  const apiKey = env.MEMORY_EMBEDDING_API_KEY ?? env.OPENAI_API_KEY;
  if (!apiKey || apiKey.startsWith('sk-or-')) return null;
  return { apiKey, model: env.MEMORY_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL };
}

export function memoryEmbeddingText(memory: Pick<EmbeddableMemory, 'kind' | 'title' | 'content'>) {
  return `Kind: ${memory.kind}\nTitle: ${memory.title}\nContent: ${memory.content}`;
}

export function validateMemoryEmbedding(values: number[], model: string): MemoryEmbedding {
  if (values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`memory_embedding_dimension_mismatch_${values.length}`);
  }
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error('memory_embedding_contains_invalid_values');
  }
  return { values, model };
}

function embeddingModel(config: NonNullable<ReturnType<typeof getMemoryEmbeddingConfig>>) {
  return createOpenAI({ apiKey: config.apiKey }).embeddingModel(config.model);
}

export async function embedMemoryQuery(
  env: MemoryEmbeddingEnvironment,
  query: string,
): Promise<MemoryEmbedding | null> {
  const config = getMemoryEmbeddingConfig(env);
  if (!config || !query.trim()) return null;
  const result = await embed({
    model: embeddingModel(config),
    value: query.trim().slice(0, 4_000),
    abortSignal: AbortSignal.timeout(QUERY_EMBEDDING_TIMEOUT_MS),
    maxRetries: 1,
  });
  return validateMemoryEmbedding(result.embedding, config.model);
}

export async function refreshMemoryEmbedding(
  db: Database,
  env: MemoryEmbeddingEnvironment,
  clerkUserId: string,
  memory: EmbeddableMemory,
) {
  const config = getMemoryEmbeddingConfig(env);
  if (!config) return false;
  const result = await embed({
    model: embeddingModel(config),
    value: memoryEmbeddingText(memory).slice(0, 4_000),
    abortSignal: AbortSignal.timeout(EMBEDDING_TIMEOUT_MS),
    maxRetries: 1,
  });
  return setMemoryEmbedding(
    db,
    clerkUserId,
    memory.id,
    validateMemoryEmbedding(result.embedding, config.model),
    memory.updatedAt,
  );
}

export async function backfillMemoryEmbeddings(
  db: Database,
  env: MemoryEmbeddingEnvironment,
  clerkUserId: string,
) {
  const config = getMemoryEmbeddingConfig(env);
  if (!config) return 0;
  const settings = await getMemorySettings(db, clerkUserId);
  if (!settings.enabled) return 0;
  const memories = await listMemoriesMissingEmbeddings(
    db,
    clerkUserId,
    BACKFILL_LIMIT,
    config.model,
  );
  if (memories.length === 0) return 0;
  const result = await embedMany({
    model: embeddingModel(config),
    values: memories.map((memory) => memoryEmbeddingText(memory).slice(0, 4_000)),
    abortSignal: AbortSignal.timeout(EMBEDDING_TIMEOUT_MS),
    maxRetries: 1,
  });
  const updates = await Promise.all(
    memories.map((memory, index) =>
      setMemoryEmbedding(
        db,
        clerkUserId,
        memory.id,
        validateMemoryEmbedding(result.embeddings[index] ?? [], config.model),
        memory.updatedAt,
      ),
    ),
  );
  return updates.filter(Boolean).length;
}
