import { describe, expect, it } from 'vitest';

import { periodRange, spendingChanges, summarizeSpending } from './spending';
import { tx } from './test-fixtures';

const now = new Date('2026-11-20T12:00:00.000Z');

describe('periodRange', () => {
  it('compares month-to-date with the same days last month', () => {
    const { current, previous } = periodRange('month', now);
    expect(current.label).toBe('November 2026');
    expect(current.from.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(previous.from.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(previous.to.toISOString()).toBe('2026-10-20T12:00:00.000Z');
  });

  it('covers the whole of last month', () => {
    const { current } = periodRange('last_month', now);
    expect(current.label).toBe('October 2026');
    expect(current.to.toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });
});

describe('summarizeSpending', () => {
  it('totals money out by category and recipient, in USD', () => {
    const summary = summarizeSpending(
      [
        tx({ amount: 300 }),
        tx({ amount: 6_500, currency: 'GHS', category: 'Payroll', counterparty: 'Payroll' }),
        tx({ amount: 50, direction: 'received', category: 'Deposits' }),
        tx({ amount: 100, direction: 'swap', category: 'Conversions' }),
        tx({ amount: 999, createdAt: '2026-10-10T10:00:00.000Z' }),
      ],
      periodRange('month', now).current,
    );
    expect(summary).toMatchObject({ outflow: 722.5, inflow: 50, net: -672.5 });
    expect(summary.byCategory.map((item) => item.category)).toEqual(['Payroll', 'Suppliers']);
    expect(summary.topRecipients[0]).toMatchObject({ name: 'Payroll', amount: 422.5 });
  });

  it('nets refunds out of spending instead of counting them as income', () => {
    const summary = summarizeSpending(
      [tx({ amount: 101 }), tx({ amount: 101, direction: 'received', category: 'Refunds' })],
      periodRange('month', now).current,
    );
    expect(summary).toMatchObject({ outflow: 0, inflow: 0 });
  });
});

describe('spendingChanges', () => {
  it('reports only meaningful moves', () => {
    const range = periodRange('month', now);
    const current = summarizeSpending(
      [
        tx({ amount: 118 }),
        tx({ amount: 30, category: 'Bills' }),
        tx({ amount: 103, category: 'Cards' }),
      ],
      range.current,
    );
    const previous = summarizeSpending(
      [
        tx({ amount: 100, createdAt: '2026-10-05T00:00:00.000Z' }),
        tx({ amount: 100, category: 'Cards', createdAt: '2026-10-05T00:00:00.000Z' }),
      ],
      range.previous,
    );
    expect(spendingChanges(current, previous)).toEqual([
      { category: 'Bills', current: 30, previous: 0, change: null },
    ]);
  });
});
