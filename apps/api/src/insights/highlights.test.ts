import { describe, expect, it } from 'vitest';

import { buildHighlights, buildTreasury } from './highlights';

const summary = {
  period: 'month' as const,
  label: 'November 2026',
  from: '2026-11-01T00:00:00.000Z',
  to: '2026-11-20T00:00:00.000Z',
  currency: 'USD',
  inflow: 500,
  outflow: 1_000,
  net: -500,
  byCategory: [{ category: 'Payroll', amount: 800, count: 1, share: 0.8 }],
  topRecipients: [],
};

const forecast = {
  currency: 'USD',
  days: 30,
  startBalance: 1_000,
  endBalance: -200,
  lowestBalance: -200,
  lowestAt: '2026-12-10T00:00:00.000Z',
  averageDailyNet: -10,
  upcomingTotal: 900,
  points: [],
};

describe('buildHighlights', () => {
  it('says where money went, what changed, and when it runs short', () => {
    const highlights = buildHighlights({
      summary,
      changes: [{ category: 'Payroll', current: 800, previous: 500, change: 0.6 }],
      duplicates: [],
      forecast,
      upcoming: [],
    });
    expect(highlights[0]).toBe('$1,000 out; the most went to Payroll ($800, 80%).');
    expect(highlights[1]).toBe(
      'You spent 60% more on Payroll than the period before ($800 vs $500).',
    );
    expect(highlights[2]).toContain('runs out around Dec 10');
  });

  it('stays quiet when there is nothing to report', () => {
    expect(
      buildHighlights({
        summary: { ...summary, outflow: 0, byCategory: [] },
        changes: [],
        duplicates: [],
        forecast: { ...forecast, lowestBalance: 1_000, endBalance: 1_000 },
        upcoming: [],
      }),
    ).toEqual([]);
  });
});

describe('buildTreasury', () => {
  it('lists balances and bills by due date, labelled demo', () => {
    const overview = buildTreasury({
      wallets: [{ id: 'w-usd', currency: 'USD', balance: 1_000, usdEquivalent: 1_000 }],
      upcoming: [
        {
          label: 'Rent',
          amount: 900,
          currency: 'USD',
          dueAt: '2026-11-25T09:00:00.000Z',
          kind: 'recurring',
        },
        {
          label: 'AWS',
          amount: 42,
          currency: 'USD',
          dueAt: '2026-11-22T09:00:00.000Z',
          kind: 'invoice',
        },
      ],
      forecast,
    });
    expect(overview.totalUsd).toBe(1_000);
    expect(overview.upcomingOutflows.map((item) => item.label)).toEqual([
      'AWS · Nov 22',
      'Rent · Nov 25',
    ]);
    expect(overview.notes.at(-1)).toBe('Demo balances until WeWire is live.');
  });
});
