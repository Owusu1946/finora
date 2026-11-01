import {
  convertDemoAmount,
  type InsightPeriod,
  type LedgerTransaction,
  type SpendingSummary,
} from '@finora/shared';

const DAY_MS = 86_400_000;
const round = (value: number) => Math.round(value * 100) / 100;

export type PeriodRange = { period: InsightPeriod; label: string; from: Date; to: Date };

/** The date range a period covers, and the range just before it (for comparisons). */
export function periodRange(period: InsightPeriod, now = new Date()) {
  const startOfMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 1));
  const monthLabel = (date: Date) =>
    date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  let current: PeriodRange;
  let previous: PeriodRange;
  if (period === 'month' || period === 'last_month') {
    const offset = period === 'month' ? 0 : -1;
    const from = startOfMonth(now.getUTCFullYear(), now.getUTCMonth() + offset);
    const to = period === 'month' ? now : startOfMonth(now.getUTCFullYear(), now.getUTCMonth());
    const prevFrom = startOfMonth(from.getUTCFullYear(), from.getUTCMonth() - 1);
    // Compare month-to-date with the same number of days last month.
    const prevTo =
      period === 'month' ? new Date(prevFrom.getTime() + (to.getTime() - from.getTime())) : from;
    current = { period, label: monthLabel(from), from, to };
    previous = { period, label: monthLabel(prevFrom), from: prevFrom, to: prevTo };
  } else {
    const days = period === 'week' ? 7 : 90;
    const from = new Date(now.getTime() - days * DAY_MS);
    current = { period, label: `Last ${days} days`, from, to: now };
    previous = {
      period,
      label: `The ${days} days before`,
      from: new Date(from.getTime() - days * DAY_MS),
      to: from,
    };
  }
  return { current, previous };
}

function inRange(tx: LedgerTransaction, range: PeriodRange) {
  const at = new Date(tx.createdAt).getTime();
  return at >= range.from.getTime() && at < range.to.getTime() + 1 && tx.status === 'completed';
}

/** Money in, money out, and where it went, in `currency` at demo rates. */
export function summarizeSpending(
  transactions: LedgerTransaction[],
  range: PeriodRange,
  currency = 'USD',
): SpendingSummary {
  const value = (tx: LedgerTransaction) => convertDemoAmount(tx.amount, tx.currency, currency);
  const inPeriod = transactions.filter((tx) => inRange(tx, range));
  // Conversions and refunds move money between the user's own wallets.
  const out = inPeriod.filter((tx) => tx.direction === 'sent');
  const inflow = inPeriod
    .filter((tx) => tx.direction === 'received' && tx.category !== 'Refunds')
    .reduce((sum, tx) => sum + value(tx), 0);
  const refunds = inPeriod
    .filter((tx) => tx.direction === 'received' && tx.category === 'Refunds')
    .reduce((sum, tx) => sum + value(tx), 0);
  const outflow = Math.max(0, out.reduce((sum, tx) => sum + value(tx), 0) - refunds);

  const byCategory = new Map<string, { amount: number; count: number }>();
  const byRecipient = new Map<string, { name: string; amount: number; count: number }>();
  for (const tx of out) {
    const category = byCategory.get(tx.category) ?? { amount: 0, count: 0 };
    byCategory.set(tx.category, { amount: category.amount + value(tx), count: category.count + 1 });
    const key = tx.counterparty.toLowerCase();
    const recipient = byRecipient.get(key) ?? { name: tx.counterparty, amount: 0, count: 0 };
    byRecipient.set(key, { ...recipient, amount: recipient.amount + value(tx), count: recipient.count + 1 });
  }
  const total = [...byCategory.values()].reduce((sum, item) => sum + item.amount, 0);

  return {
    period: range.period,
    label: range.label,
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    currency,
    inflow: round(inflow),
    outflow: round(outflow),
    net: round(inflow - outflow),
    byCategory: [...byCategory.entries()]
      .map(([category, item]) => ({
        category,
        amount: round(item.amount),
        count: item.count,
        share: total ? round(item.amount / total) : 0,
      }))
      .sort((a, b) => b.amount - a.amount),
    topRecipients: [...byRecipient.values()]
      .map((item) => ({ ...item, amount: round(item.amount) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5),
  };
}

export type SpendingChange = {
  category: string;
  current: number;
  previous: number;
  /** Fractional change, e.g. 0.18 for 18% more. Null when there was nothing before. */
  change: number | null;
};

/**
 * Categories whose spending moved meaningfully between two periods: at least
 * 15% and at least 20 units of the summary currency.
 */
export function spendingChanges(current: SpendingSummary, previous: SpendingSummary) {
  const before = new Map(previous.byCategory.map((item) => [item.category, item.amount]));
  const categories = new Set([...current.byCategory.map((item) => item.category), ...before.keys()]);
  const changes: SpendingChange[] = [];
  for (const category of categories) {
    const now = current.byCategory.find((item) => item.category === category)?.amount ?? 0;
    const then = before.get(category) ?? 0;
    if (Math.abs(now - then) < 20) continue;
    const change = then > 0 ? round((now - then) / then) : null;
    if (change !== null && Math.abs(change) < 0.15) continue;
    changes.push({ category, current: now, previous: then, change });
  }
  return changes.sort((a, b) => Math.abs(b.current - b.previous) - Math.abs(a.current - a.previous));
}
