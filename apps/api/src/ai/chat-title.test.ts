import type { UIMessage } from 'ai';

import { describe, expect, it } from 'vitest';

import { fallbackChatTitle } from './chat-title';

function userMessage(text: string): UIMessage {
  return { id: 'user-1', role: 'user', parts: [{ type: 'text', text }] };
}

describe('fallbackChatTitle', () => {
  it('creates a concise title from the first user message', () => {
    expect(fallbackChatTitle([userMessage('Please review my latest business transactions')])).toBe(
      'Please review my latest business transactions',
    );
  });

  it('normalizes whitespace and limits the title to seven words', () => {
    expect(
      fallbackChatTitle([
        userMessage('  Help   me\nprepare a supplier payment for tomorrow morning please  '),
      ]),
    ).toBe('Help me prepare a supplier payment for');
  });

  it('uses a safe fallback when no user text exists', () => {
    expect(fallbackChatTitle([])).toBe('New chat');
  });
});
