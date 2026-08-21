import { CreateMemoryInputSchema } from '@finora/shared';
import { describe, expect, it } from 'vitest';

import { isMemoryEmbeddingCompatible } from '../ai/memory-contract';
import { normalizeMemoryKey, rankHybridMemories, rankRelevantMemories } from './memory-store';

describe('memory store helpers', () => {
  it('rejects secrets and full payment identifiers', () => {
    for (const content of ['My PIN is 1234', 'Use password hunter2', 'My MoMo is 0240000000']) {
      expect(
        CreateMemoryInputSchema.safeParse({
          kind: 'note',
          title: 'Sensitive note',
          content,
        }).success,
      ).toBe(false);
    }
  });

  it('normalizes equivalent titles for idempotent writes', () => {
    expect(normalizeMemoryKey('  Local Sends: GHS! ')).toBe('local sends ghs');
  });

  it('retrieves only lexically relevant explicit memories', () => {
    const memories = [
      { title: 'Local sends', content: 'Prefer GHS for payments in Ghana.' },
      { title: 'Payroll date', content: 'Prepare payroll on the twenty-fifth.' },
      { title: 'AWS', content: 'Review cloud invoices before paying.' },
    ];
    expect(rankRelevantMemories(memories, 'Please prepare the payroll for the 25th')).toEqual([
      memories[1],
    ]);
    expect(rankRelevantMemories(memories, 'hello')).toEqual([]);
  });

  it('combines semantic and lexical relevance without admitting weak nearest matches', () => {
    const memories = [
      { id: 'currency', title: 'Preferred reporting currency', content: 'Use GHS for summaries.' },
      { id: 'theme', title: 'Theme', content: 'Use dark mode.' },
      { id: 'payroll', title: 'Payroll date', content: 'Prepare payroll on the twenty-fifth.' },
    ];
    expect(
      rankHybridMemories(memories, 'What denomination should financial reports use?', [
        { id: 'currency', distance: 0.18 },
        { id: 'theme', distance: 0.7 },
      ]),
    ).toEqual([memories[0]]);
    expect(
      rankHybridMemories(memories, 'Please prepare payroll', [
        { id: 'currency', distance: 0.2 },
        { id: 'payroll', distance: 0.25 },
      ])[0],
    ).toBe(memories[2]);
  });

  it('keeps semantically retrieved memories eligible when using Workers AI dimensions', () => {
    const memories = [
      { id: 'currency', title: 'Reporting currency', content: 'Use GHS.' },
      { id: 'theme', title: 'Theme', content: 'Use dark mode.' },
    ];
    const semantic = [{ id: 'currency', distance: 0.2 }];
    expect(rankHybridMemories(memories, 'Which currency?', semantic)).toEqual([memories[0]]);
  });

  it('rejects stale or malformed embedding contracts before vector SQL', () => {
    expect(isMemoryEmbeddingCompatible(Array.from({ length: 1_024 }, () => 0.1))).toBe(true);
    expect(isMemoryEmbeddingCompatible(Array.from({ length: 1_536 }, () => 0.1))).toBe(false);
    expect(
      isMemoryEmbeddingCompatible(
        Array.from({ length: 1_024 }, (_, index) => (index === 4 ? Number.NaN : 0.1)),
      ),
    ).toBe(false);
  });
});
