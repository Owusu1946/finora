import { describe, expect, it, vi } from 'vitest';

import type { VirtualCardRow } from '../db/virtual-cards';

import { createLithicClient, LithicError, toVirtualCard } from './lithic';

const card = {
  token: 'tok_1',
  last_four: '2199',
  pan: '4111111111112199',
  cvv: '711',
  exp_month: '3',
  exp_year: '2031',
  state: 'OPEN',
  spend_limit: 5_000,
  memo: 'Netflix',
};

function client(responses: unknown[], status = 200) {
  const fetch = vi.fn();
  for (const body of responses) {
    fetch.mockResolvedValueOnce(Response.json(body, { status }));
  }
  return {
    fetch,
    lithic: createLithicClient({
      apiKey: 'key',
      baseUrl: 'https://sandbox.lithic.com',
      fetch: fetch as unknown as typeof globalThis.fetch,
    }),
  };
}

const row: VirtualCardRow = {
  id: 'card_1',
  clerkUserId: 'user_1',
  provider: 'lithic',
  providerCardToken: 'tok_1',
  label: 'Netflix',
  createdAt: new Date('2026-10-30T00:00:00.000Z'),
  updatedAt: new Date('2026-10-30T00:00:00.000Z'),
  closedAt: null,
};

describe('createLithicClient', () => {
  it('creates a virtual card with a lifetime spend limit in cents', async () => {
    const { fetch, lithic } = client([card]);

    await lithic.createCard({ memo: 'Netflix', spendLimitCents: 5_000 });

    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('https://sandbox.lithic.com/v1/cards');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('key');
    expect(JSON.parse(init.body)).toEqual({
      type: 'VIRTUAL',
      memo: 'Netflix',
      spend_limit: 5_000,
      spend_limit_duration: 'FOREVER',
      state: 'OPEN',
    });
  });

  it('maps app statuses to Lithic card states', async () => {
    const { fetch, lithic } = client([card, card, card]);

    await lithic.updateCard('tok_1', { status: 'frozen' });
    await lithic.updateCard('tok_1', { status: 'active' });
    await lithic.updateCard('tok_1', { status: 'cancelled', memo: 'Old' });

    const bodies = fetch.mock.calls.map(([, init]) => JSON.parse(init.body));
    expect(bodies).toEqual([
      { state: 'PAUSED' },
      { state: 'OPEN' },
      { memo: 'Old', state: 'CLOSED' },
    ]);
  });

  it('sums approved, unvoided spend across pages', async () => {
    const { fetch, lithic } = client([
      {
        data: [
          { token: 't1', result: 'APPROVED', status: 'SETTLED', amount: 1_299 },
          { token: 't2', result: 'DECLINED', status: 'DECLINED', amount: 9_999 },
        ],
        has_more: true,
      },
      {
        data: [
          { token: 't3', result: 'APPROVED', status: 'PENDING', amount: 500 },
          { token: 't4', result: 'APPROVED', status: 'VOIDED', amount: 700 },
        ],
        has_more: false,
      },
    ]);

    expect(await lithic.spentCents('tok_1')).toBe(1_799);
    expect(String(fetch.mock.calls[1]![0])).toContain('starting_after=t2');
  });

  it('counts refunds against spend but never goes below zero', async () => {
    const { lithic } = client([
      {
        data: [
          { token: 't1', result: 'APPROVED', status: 'SETTLED', amount: 1_000 },
          { token: 't2', result: 'APPROVED', status: 'SETTLED', amount: -400 },
        ],
        has_more: false,
      },
      {
        data: [{ token: 't3', result: 'APPROVED', status: 'SETTLED', amount: -2_000 }],
        has_more: false,
      },
    ]);

    expect(await lithic.spentCents('tok_1')).toBe(600);
    expect(await lithic.spentCents('tok_2')).toBe(0);
  });

  it('surfaces Lithic errors with their status', async () => {
    const { lithic } = client([{ message: 'Card not found' }], 404);

    await expect(lithic.getCard('missing')).rejects.toEqual(new LithicError('Card not found', 404));
  });
});

describe('toVirtualCard', () => {
  it('builds the app card from our record and the live Lithic card', () => {
    expect(toVirtualCard(row, card, 1_299)).toEqual({
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
    });
  });

  it('maps paused and closed cards', () => {
    expect(toVirtualCard(row, { ...card, state: 'PAUSED' }, 0).status).toBe('frozen');
    expect(toVirtualCard(row, { ...card, state: 'CLOSED' }, 0).status).toBe('cancelled');
    expect(toVirtualCard({ ...row, closedAt: new Date() }, card, 0).status).toBe('cancelled');
    expect(toVirtualCard(row, { ...card, pan: '5555555555554444' }, 0).network).toBe('mastercard');
  });
});
