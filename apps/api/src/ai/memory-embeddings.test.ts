import { describe, expect, it } from 'vitest';

import {
  getMemoryEmbeddingConfig,
  MEMORY_EMBEDDING_MODEL,
  memoryEmbeddingText,
  parseMemoryEmbeddingResponse,
  validateMemoryEmbedding,
} from './memory-embeddings';

describe('memory embeddings', () => {
  it('is optional when the Workers AI binding is unavailable', () => {
    expect(getMemoryEmbeddingConfig({})).toBeNull();
    const ai = { run: async () => ({ data: [] }) } as unknown as Ai;
    expect(getMemoryEmbeddingConfig({ AI: ai })).toEqual({ ai, model: MEMORY_EMBEDDING_MODEL });
  });

  it('uses a deterministic record representation', () => {
    expect(
      memoryEmbeddingText({
        kind: 'preference',
        title: 'Reporting currency',
        content: 'Use GHS for summaries.',
      }),
    ).toBe('Kind: preference\nTitle: Reporting currency\nContent: Use GHS for summaries.');
  });

  it('rejects vectors that cannot be stored in the configured halfvec column', () => {
    expect(() => validateMemoryEmbedding([0.1], 'test')).toThrow(
      'memory_embedding_dimension_mismatch_1',
    );
    expect(() =>
      validateMemoryEmbedding(
        Array.from({ length: 1_024 }, () => Number.NaN),
        'test',
      ),
    ).toThrow('memory_embedding_contains_invalid_values');
  });

  it('accepts a complete Workers AI batch response', () => {
    const values = Array.from({ length: 1_024 }, (_, index) => index / 1_024);
    expect(parseMemoryEmbeddingResponse({ data: [values], shape: [1, 1_024] }, 1)).toEqual([
      { values, model: MEMORY_EMBEDDING_MODEL },
    ]);
  });

  it('rejects malformed or incomplete Workers AI responses', () => {
    expect(() => parseMemoryEmbeddingResponse({}, 1)).toThrow('memory_embedding_response_invalid');
    expect(() => parseMemoryEmbeddingResponse({ data: [] }, 1)).toThrow(
      'memory_embedding_response_count_mismatch_0',
    );
    expect(() => parseMemoryEmbeddingResponse({ data: [[0.1]] }, 1)).toThrow(
      'memory_embedding_dimension_mismatch_1',
    );
  });
});
