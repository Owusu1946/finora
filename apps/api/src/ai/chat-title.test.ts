import type { UIMessage } from 'ai';

import { describe, expect, it, vi } from 'vitest';

import {
  cleanGeneratedTitle,
  fallbackChatTitle,
  firstExchange,
  generateChatTitle,
  TITLE_MODEL,
} from './chat-title';

function message(role: UIMessage['role'], text: string): UIMessage {
  return { id: `${role}-1`, role, parts: [{ type: 'text', text }] };
}

function fakeAi(response: unknown) {
  const run = vi.fn().mockResolvedValue({ response });
  return { ai: { run } as unknown as Ai, run };
}

describe('cleanGeneratedTitle', () => {
  it.each([
    ['Rent payment to Kwame', 'Rent payment to Kwame'],
    ['"Cedi to dollar rate."', 'Cedi to dollar rate'],
    ['Title: march payroll run', 'March payroll run'],
    ['**Invoices due this week**', 'Invoices due this week'],
    ['Freezing a stolen card\nThis title describes the chat.', 'Freezing a stolen card'],
  ])('cleans %j', (input, expected) => {
    expect(cleanGeneratedTitle(input)).toBe(expected);
  });

  it('keeps titles within six words and 48 characters without an ellipsis', () => {
    const title = cleanGeneratedTitle(
      'Quarterly supplier payment schedule review and approval planning',
    );
    expect(title).toBe('Quarterly supplier payment schedule review and');
    expect(title!.length).toBeLessThanOrEqual(48);
    expect(title).not.toContain('...');
  });

  it('treats small talk as no topic', () => {
    expect(cleanGeneratedTitle('New chat')).toBeNull();
    expect(cleanGeneratedTitle('  new chat. ')).toBeNull();
    expect(cleanGeneratedTitle('')).toBeNull();
  });

  it('rejects titles that leak numbers', () => {
    expect(cleanGeneratedTitle('Send 500 GHS to Kwame')).toBeNull();
    expect(cleanGeneratedTitle('Account 0241234567 balance')).toBeNull();
  });
});

describe('fallbackChatTitle', () => {
  it('uses the first words of the user message', () => {
    expect(
      fallbackChatTitle([message('user', 'Please review my latest business transactions')]),
    ).toBe('Please review my latest business transactions');
  });

  it('drops words with digits and never adds an ellipsis', () => {
    expect(
      fallbackChatTitle([message('user', 'send 500 cedis to kwame on 0241234567 for rent today')]),
    ).toBe('Send cedis to kwame on for');
  });

  it('uses a safe fallback when no user text exists', () => {
    expect(fallbackChatTitle([])).toBe('New chat');
    expect(fallbackChatTitle([message('user', '123 456')])).toBe('New chat');
  });
});

describe('firstExchange', () => {
  it('returns the first user message and first assistant reply', () => {
    expect(
      firstExchange([
        message('user', 'Pay  TechFlow'),
        message('assistant', 'Prepared a payment.'),
        message('user', 'Thanks'),
      ]),
    ).toEqual({ message: 'Pay TechFlow', reply: 'Prepared a payment.' });
  });
});

describe('generateChatTitle', () => {
  it('asks the Workers AI title model with the exchange and returns a clean title', async () => {
    const { ai, run } = fakeAi('Payment to TechFlow.');

    const title = await generateChatTitle(ai, {
      message: 'Pay TechFlow 780 GBP',
      reply: 'I prepared the payment.',
    });

    expect(title).toBe('Payment to TechFlow');
    expect(run).toHaveBeenCalledOnce();
    const [model, input] = run.mock.calls[0]!;
    expect(model).toBe(TITLE_MODEL);
    const last = input.messages.at(-1);
    expect(last).toEqual({
      role: 'user',
      content: 'User: Pay TechFlow 780 GBP\nAssistant: I prepared the payment.',
    });
  });

  it('returns null for small talk and skips the model without user text', async () => {
    const { ai, run } = fakeAi('New chat');
    expect(await generateChatTitle(ai, { message: 'hi' })).toBeNull();
    expect(await generateChatTitle(ai, { message: '   ' })).toBeNull();
    expect(run).toHaveBeenCalledOnce();
  });
});
