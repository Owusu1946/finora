/** The embedding contract shared by inference and vector retrieval. */
export const MEMORY_EMBEDDING_MODEL = '@cf/baai/bge-m3' as const;
export const MEMORY_EMBEDDING_DIMENSIONS = 1_024 as const;

export function isMemoryEmbeddingCompatible(values: number[]) {
  return values.length === MEMORY_EMBEDDING_DIMENSIONS && values.every(Number.isFinite);
}
