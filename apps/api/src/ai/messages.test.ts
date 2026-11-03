import type { UIMessage } from 'ai';

import { describe, expect, it } from 'vitest';

import {
  generatedMessagesForPersistence,
  reconcileChatMessages,
  sanitizeIncomingMessages,
  withoutDisplayOnlyParts,
} from './messages';

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

  it('keeps the complete local clarification context when the server snapshot is behind', () => {
    const clarification = textMessage('assistant-clarification', 'assistant', 'Which pay period?');
    expect(
      reconcileChatMessages([firstUser], [firstUser, clarification, secondUser], 'submit-message'),
    ).toEqual([firstUser, clarification, secondUser]);
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

describe('automation cards in chat history', () => {
  const card: UIMessage = {
    id: 'automation-1',
    role: 'assistant',
    parts: [
      { type: 'text', text: 'Your automation "Rent" ran.' },
      {
        type: 'dynamic-tool',
        toolName: 'automation_ready',
        toolCallId: 'automation_ready_1',
        state: 'output-available',
        input: { automationId: 'a1' },
        output: { automationId: 'a1', name: 'Rent', description: 'x', prompt: 'Pay rent' },
      },
    ],
  };
  const reply = textMessage('user-1', 'user', 'Thanks');

  it('accepts and keeps the card when the user replies in the Automations chat', () => {
    const sanitized = sanitizeIncomingMessages([card, reply]);
    expect(sanitized?.[0]).toEqual(card);
    expect(
      generatedMessagesForPersistence([card, reply, textMessage('a2', 'assistant', 'Ok')], [])[0],
    ).toEqual(card);
  });

  it('hides the card from the model but keeps the text', () => {
    expect(withoutDisplayOnlyParts([card])[0]?.parts).toEqual([
      { type: 'text', text: 'Your automation "Rent" ran.' },
    ]);
  });
});
