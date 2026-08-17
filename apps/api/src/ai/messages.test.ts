import type { UIMessage } from 'ai';

import { describe, expect, it } from 'vitest';

import { reconcileChatMessages } from './messages';

function textMessage(id: string, role: 'user' | 'assistant', text: string): UIMessage {
  return { id, role, parts: [{ type: 'text', text }] };
}

describe('reconcileChatMessages', () => {
  const firstUser = textMessage('user-1', 'user', 'Hello');
  const firstAssistant = textMessage('assistant-1', 'assistant', 'Hi');
  const secondUser = textMessage('user-2', 'user', 'What is my balance?');

  it('accepts a normal user turn on the current stored history', () => {
    expect(
      reconcileChatMessages(
        [firstUser, firstAssistant],
        [firstUser, firstAssistant, secondUser],
        'submit-message',
      ),
    ).toEqual([firstUser, firstAssistant, secondUser]);
  });

  it('preserves an assistant response persisted after the client state read', () => {
    expect(
      reconcileChatMessages([firstUser, firstAssistant], [firstUser, secondUser], 'submit-message'),
    ).toEqual([firstUser, firstAssistant, secondUser]);
  });

  it('ignores a divergent client base and appends to authoritative stored history', () => {
    const divergentUser = textMessage('different-user', 'user', 'Different history');
    expect(
      reconcileChatMessages(
        [firstUser, firstAssistant],
        [divergentUser, secondUser],
        'submit-message',
      ),
    ).toEqual([firstUser, firstAssistant, secondUser]);
  });

  it('accepts the first user message even when the client includes local-only history', () => {
    const localGreeting = textMessage('local-assistant', 'assistant', 'Welcome');
    expect(reconcileChatMessages([], [localGreeting, firstUser], 'submit-message')).toEqual([
      firstUser,
    ]);
  });

  it('rejects replaying an already stored user message as a new turn', () => {
    expect(
      reconcileChatMessages(
        [firstUser, firstAssistant, secondUser],
        [firstUser, firstAssistant, secondUser],
        'submit-message',
      ),
    ).toBeNull();
  });
});
