import { describe, expect, it } from 'vitest';

import { maskTail, toLedgerTransaction } from './ledger';

describe('maskTail', () => {
  it('keeps only the last four characters', () => {
    expect(maskTail('0241 234 567')).toBe('•••• 4567');
    expect(maskTail('1234')).toBe('1234');
    expect(maskTail('•••• 9999')).toBe('•••• 9999');
    expect(maskTail('')).toBeNull();
  });
});

describe('toLedgerTransaction', () => {
  it('maps minor units and keeps it labelled demo', () => {
    const tx = toLedgerTransaction({
      id: 'tx_1',
      clerkUserId: 'user_1',
      direction: 'swap',
      status: 'completed',
      currency: 'USD',
      amountMinor: 10_000,
      toCurrency: 'GHS',
      toAmountMinor: 153_231,
      feeMinor: 40,
      counterparty: 'USD → GHS',
      method: 'Conversion',
      reference: null,
      destination: null,
      source: 'chat',
      kind: 'action',
      sourceId: 'act_1',
      mode: 'demo',
      createdAt: new Date('2026-10-31T10:00:00.000Z'),
    });
    expect(tx).toMatchObject({
      amount: 100,
      toAmount: 1532.31,
      fee: 0.4,
      mode: 'demo',
      createdAt: '2026-10-31T10:00:00.000Z',
    });
  });
});
