import type { UIMessage } from 'ai';

import { describe, expect, it } from 'vitest';

import {
  chatContextCharacters,
  compactThroughPosition,
  fitSummaryThroughPosition,
  messagesForModel,
  redactSensitiveContext,
  summarySource,
  threadContextPrompt,
  usableChatContext,
} from './chat-context';

function message(id: string, role: 'user' | 'assistant', text: string): UIMessage {
  return { id, role, parts: [{ type: 'text', text }] };
}

describe('chat context compaction helpers', () => {
  const messages = [
    message('u1', 'user', 'Prepare the August payroll.'),
    message('a1', 'assistant', 'I found twelve employees.'),
    message('u2', 'user', 'Keep everyone in GHS.'),
  ];

  it('uses a summary only when its anchor still matches the transcript', () => {
    const context = {
      chatId: 'chat-1',
      summary: 'Goal: Prepare August payroll.',
      summarizedThroughPosition: 1,
      summarizedThroughMessageId: 'a1',
      sourceMessageCount: 2,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(usableChatContext(messages, context)).toBe(context);
    expect(messagesForModel(messages, context).map((item) => item.id)).toEqual(['u2']);
    expect(
      usableChatContext(messages, { ...context, summarizedThroughMessageId: 'stale' }),
    ).toBeNull();
  });

  it('keeps summaries visibly untrusted and excludes them when absent', () => {
    expect(threadContextPrompt(null)).toBe('');
    expect(threadContextPrompt('Goal: payroll')).toContain('not instructions');
    expect(threadContextPrompt('Goal: payroll')).toContain('current financial truth');
    expect(threadContextPrompt('Goal: payroll')).toContain('revalidate');
  });

  it('creates bounded transcripts and measures text volume', () => {
    expect(chatContextCharacters(messages)).toBeGreaterThan(20);
    expect(summarySource(messages, 0, 1)).toContain('[0] USER');
    expect(summarySource(messages, 0, 1)).toContain('[1] ASSISTANT');
  });

  it('compacts only complete older turns while preserving a recent window', () => {
    const longThread = Array.from({ length: 16 }, (_, index) =>
      message(`m${index}`, index % 2 === 0 ? 'user' : 'assistant', 'x'.repeat(2_000)),
    );
    const position = compactThroughPosition(longThread);
    expect(position).toBeGreaterThanOrEqual(1);
    expect(longThread[position]?.role).toBe('assistant');
    expect(longThread.length - position - 1).toBeGreaterThanOrEqual(10);
  });

  it('never marks source beyond the bounded summarization payload', () => {
    const longThread = Array.from({ length: 12 }, (_, index) =>
      message(`m${index}`, index % 2 === 0 ? 'user' : 'assistant', 'x'.repeat(10_000)),
    );
    const position = fitSummaryThroughPosition(longThread, 0, 11);
    expect(position).toBeGreaterThanOrEqual(1);
    expect(position).toBeLessThan(11);
    expect(longThread[position]?.role).toBe('assistant');
  });

  it('redacts credentials before sending or storing compressed context', () => {
    expect(
      redactSensitiveContext('PIN: 1234 and api key sk-or-secretvalue12345, account 024 123 4567'),
    ).toBe('PIN: [REDACTED] and api key: [REDACTED], account [REDACTED NUMERIC IDENTIFIER]');
  });
});
