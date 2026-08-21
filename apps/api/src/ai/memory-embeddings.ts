import type { MemoryKind } from '@finora/shared';

import type { Database } from '../db/client';

import {
  getMemorySettings,
  listMemoriesMissingEmbeddings,
  setMemoryEmbedding,
} from '../db/memory-store';

export const MEMORY_EMBEDDING_MODEL = '@cf/baai/bge-m3' as const;
const EMBEDDING_DIMENSIONS = 1_024;
const QUERY_EMBEDDING_TIMEOUT_MS = 1_500;
const BACKFILL_LIMIT = 5;
const MAX_EMBEDDING_CHARACTERS = 12_000;
type MemoryEmbeddingEnvironment = { AI?: Ai };
type EmbeddableMemory = {
  id: string;
  kind: MemoryKind;
  title: string;
  content: string;
  updatedAt: Date;
};
export type MemoryEmbedding = { values: number[]; model: string };

export function getMemoryEmbeddingConfig(env: MemoryEmbeddingEnvironment) {
  if (!env.AI) return null;
  return { ai: env.AI, model: MEMORY_EMBEDDING_MODEL };
}
export function memoryEmbeddingText(memory: Pick<EmbeddableMemory, 'kind' | 'title' | 'content'>) {
  return `Kind: ${memory.kind}\nTitle: ${memory.title}\nContent: ${memory.content}`;
}
export function validateMemoryEmbedding(values: number[], model: string): MemoryEmbedding {
  if (values.length !== EMBEDDING_DIMENSIONS)
    throw new Error(`memory_embedding_dimension_mismatch_${values.length}`);
  if (values.some((value) => !Number.isFinite(value)))
    throw new Error('memory_embedding_contains_invalid_values');
  return { values, model };
}
export function parseMemoryEmbeddingResponse(result: unknown, expectedCount: number) {
  if (!result || typeof result !== 'object' || !('data' in result) || !Array.isArray(result.data))
    throw new Error('memory_embedding_response_invalid');
  if (result.data.length !== expectedCount)
    throw new Error(`memory_embedding_response_count_mismatch_${result.data.length}`);
  return result.data.map((values) => {
    if (!Array.isArray(values) || values.some((value) => typeof value !== 'number'))
      throw new Error('memory_embedding_response_invalid');
    return validateMemoryEmbedding(values, MEMORY_EMBEDDING_MODEL);
  });
}
async function runMemoryEmbeddings(ai: Ai, values: string[]) {
  const result = await ai.run(MEMORY_EMBEDDING_MODEL, {
    text: values.map((value) => value.trim().slice(0, MAX_EMBEDDING_CHARACTERS)),
    truncate_inputs: true,
  });
  return parseMemoryEmbeddingResponse(result, values.length);
}
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('memory_embedding_timeout')), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
export async function embedMemoryQuery(
  env: MemoryEmbeddingEnvironment,
  query: string,
): Promise<MemoryEmbedding | null> {
  const config = getMemoryEmbeddingConfig(env);
  if (!config || !query.trim()) return null;
  const [embedding] = await withTimeout(
    runMemoryEmbeddings(config.ai, [query]),
    QUERY_EMBEDDING_TIMEOUT_MS,
  );
  return embedding ?? null;
}
export async function refreshMemoryEmbedding(
  db: Database,
  env: MemoryEmbeddingEnvironment,
  clerkUserId: string,
  memory: EmbeddableMemory,
) {
  const config = getMemoryEmbeddingConfig(env);
  if (!config) return false;
  const [embedding] = await runMemoryEmbeddings(config.ai, [memoryEmbeddingText(memory)]);
  if (!embedding) return false;
  return setMemoryEmbedding(db, clerkUserId, memory.id, embedding, memory.updatedAt);
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
  const embeddings = await runMemoryEmbeddings(
    config.ai,
    memories.map((memory) => memoryEmbeddingText(memory)),
  );
  const updates = await Promise.all(
    memories.map((memory, index) =>
      embeddings[index]
        ? setMemoryEmbedding(db, clerkUserId, memory.id, embeddings[index], memory.updatedAt)
        : false,
    ),
  );
  return updates.filter(Boolean).length;
}
