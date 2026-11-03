import type { VirtualCardRecord } from '@finora/shared';

import { describe, expect, it, vi } from 'vitest';

import { createChatAgentTools } from './tools';

const base: VirtualCardRecord = {
  id: 'card_1',
  label: 'Netflix',
  last4: '2199',
  network: 'visa',
  currency: 'USD',
  status: 'active',
  spendLimit: 50,
  spent: 12.99,
  createdAt: '2026-10-30T00:00:00.000Z',
  pan: '4111111111112199',
  expiry: '03/31',
  cvv: '711',
};

const cards = [
  base,
  { ...base, id: 'card_2', label: 'Meta ads', status: 'frozen' as const },
  { ...base, id: 'card_3', label: 'Old travel', status: 'cancelled' as const },
];

function tools(list = cards) {
  return createChatAgentTools(undefined, undefined, undefined, undefined, undefined, undefined, {
    list: vi.fn().mockResolvedValue(list),
  });
}

async function run(
  name: 'list_virtual_cards' | 'get_virtual_card' | 'create_virtual_card',
  input: object,
) {
  const tool = tools()[name];
  return (
    tool.execute as unknown as (input: object, options: object) => Promise<Record<string, unknown>>
  )(input, { toolCallId: 'call_1', messages: [] });
}

describe('card chat tools', () => {
  it('never sends card numbers, CVV, or expiry to the model', async () => {
    const result = await run('list_virtual_cards', {});
    const listed = result.cards as VirtualCardRecord[];

    expect(listed.map((card) => card.id)).toEqual(['card_1', 'card_2']);
    for (const card of listed) {
      expect(card.pan).toBe('');
      expect(card.cvv).toBe('');
      expect(card.expiry).toBe('');
    }
  });

  it('filters by status', async () => {
    const result = await run('list_virtual_cards', { status: 'frozen' });
    expect((result.cards as VirtualCardRecord[]).map((card) => card.id)).toEqual(['card_2']);
  });

  it('finds a card by label without secrets', async () => {
    const result = await run('get_virtual_card', { label: 'meta' });
    expect(result.card).toMatchObject({ id: 'card_2', pan: '', cvv: '' });
  });

  it('only prepares a card and never issues it', async () => {
    const result = await run('create_virtual_card', { label: 'Netflix', spendLimit: 50 });
    expect(result).toEqual({
      status: 'pending',
      label: 'Netflix',
      spendLimit: 50,
      currency: 'USD',
      issueFeeUsd: 1,
    });
  });
});
