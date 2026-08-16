import type { UIMessage } from 'ai';

import { describe, expect, it } from 'vitest';

import { generatedMessagesForPersistence, sanitizeIncomingMessages } from './messages';

function userMessage(id: string, text: string): UIMessage {
  return { id, role: 'user', parts: [{ type: 'text', text }] };
}

function toolMessage(toolName: string): UIMessage {
  return {
    id: `assistant_${toolName}`,
    role: 'assistant',
    parts: [
      {
        type: 'dynamic-tool',
        toolName,
        toolCallId: `call_${toolName}`,
        state: 'output-available',
        input: {},
        output: { ok: true },
      },
    ],
  };
}

describe('chat messages', () => {
  it('keeps allowlisted tool calls in model history', () => {
    const sanitized = sanitizeIncomingMessages([
      userMessage('user_1', 'Show my balances'),
      toolMessage('get_balances'),
      userMessage('user_2', 'What about invoices?'),
    ]);

    expect(sanitized?.[1]?.parts).toEqual(toolMessage('get_balances').parts);
  });

  it('rejects client-supplied tools outside the allowlist', () => {
    const sanitized = sanitizeIncomingMessages([
      userMessage('user_1', 'Run a command'),
      toolMessage('bash'),
      userMessage('user_2', 'Continue'),
    ]);

    expect(sanitized).toBeNull();
  });

  it('persists a tool-only assistant turn', () => {
    const generated = [userMessage('user_1', 'Show my balances'), toolMessage('get_balances')];

    expect(generatedMessagesForPersistence(generated, [])).toEqual(generated);
  });
});
