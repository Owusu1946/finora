import { describe, expect, it } from 'vitest';

import {
  getMemoryEmbeddingConfig,
  memoryEmbeddingText,
  validateMemoryEmbedding,
} from './memory-embeddings';

describe('memory embeddings', () => {
  it('is optional and never reuses an OpenRouter chat key', () => {
    expect(getMemoryEmbeddingConfig({})).toBeNull();
    expect(getMemoryEmbeddingConfig({ OPENAI_API_KEY: 'sk-or-chat' })).toBeNull();
    expect(getMemoryEmbeddingConfig({ OPENAI_API_KEY: 'sk-openai' })).toEqual({
      apiKey: 'sk-openai',
      model: 'text-embedding-3-small',
    });
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
        Array.from({ length: 1_536 }, () => Number.NaN),
        'test',
      ),
    ).toThrow('memory_embedding_contains_invalid_values');
  });
});
