import { describe, expect, it } from 'vitest';

import { findDuplicatePayments, forecastCashFlow } from './cash-flow';
import { tx } from './test-fixtures';

const now = new Date('2026-11-20T12:00:00.000Z');

describe('findDuplicatePayments', () => {
  it('finds the same payment sent twice within two days', () => {
    const duplicates = findDuplicatePayments([
      tx({ id: 'a', createdAt: '2026-11-18T09:00:00.000Z' }),
      tx({ id: 'b', createdAt: '2026-11-19T08:00:00.000Z' }),
      tx({ id: 'c', createdAt: '2026-11-01T08:00:00.000Z' }),
      tx({ id: 'd', amount: 99, createdAt: '2026-11-19T09:00:00.000Z' }),
    ]);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]?.transactionIds).toEqual(['a', 'b']);
  });

  it('leaves payroll out', () => {
    expect(
      findDuplicatePayments([
        tx({ kind: 'payroll_run', createdAt: '2026-11-18T09:00:00.000Z' }),
        tx({ kind: 'payroll_run', createdAt: '2026-11-18T10:00:00.000Z' }),
      ]),
    ).toEqual([]);
  });
});

describe('forecastCashFlow', () => {
  it('projects the balance with the daily trend and known bills', () => {
    const forecast = forecastCashFlow({
      now,
      days: 30,
      wallets: [{ id: 'w-usd', currency: 'USD', balance: 1_000, usdEquivalent: 1_000 }],
      transactions: [
        tx({ amount: 300, createdAt: '2026-11-10T00:00:00.000Z' }),
        tx({
          amount: 600,
          direction: 'received',
          category: 'Deposits',
          createdAt: '2026-11-05T00:00:00.000Z',
        }),
      ],
      upcoming: [
        {
          label: 'Rent',
          amount: 900,
          currency: 'USD',
          dueAt: '2026-11-25T09:00:00.000Z',
          kind: 'recurring',
        },
        {
          label: 'Later',
          amount: 50,
          currency: 'USD',
          dueAt: '2027-02-01T00:00:00.000Z',
          kind: 'invoice',
        },
      ],
    });
    expect(forecast).toMatchObject({
      startBalance: 1_000,
      averageDailyNet: 10,
      upcomingTotal: 900,
      endBalance: 400,
    });
    expect(forecast.lowestBalance).toBeLessThan(200);
    expect(forecast.lowestAt.slice(0, 10)).toBe('2026-11-25');
  });
});
