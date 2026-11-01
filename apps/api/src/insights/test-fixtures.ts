import type { LedgerTransaction } from '@finora/shared';

/** A completed USD supplier payment; override what a test needs. */
export function tx(overrides: Partial<LedgerTransaction>): LedgerTransaction {
  return {
    id: `tx_${Math.random()}`,
    direction: 'sent',
    status: 'completed',
    currency: 'USD',
    amount: 100,
    toCurrency: null,
    toAmount: null,
    fee: null,
    counterparty: 'Acme',
    method: 'Bank account',
    reference: null,
    destination: null,
    source: 'chat',
    kind: 'action',
    category: 'Suppliers',
    mode: 'demo',
    createdAt: '2026-11-10T10:00:00.000Z',
    ...overrides,
  };
}
