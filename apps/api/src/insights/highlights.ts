import type {
  CashFlowForecast,
  DuplicatePayment,
  LedgerWallet,
  SpendingSummary,
  TreasuryOverview,
  UpcomingBill,
} from '@finora/shared';

import type { SpendingChange } from './spending';

function money(amount: number, currency: string) {
  const symbol = currency === 'USD' ? '$' : `${currency} `;
  return `${symbol}${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function day(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Plain sentences for the report card and weekly message, most useful first.
 * Each states a number or a date; nothing is said when there's nothing to say.
 */
export function buildHighlights(input: {
  summary: SpendingSummary;
  changes: SpendingChange[];
  duplicates: DuplicatePayment[];
  forecast: CashFlowForecast;
  upcoming: UpcomingBill[];
}) {
  const { summary, changes, duplicates, forecast, upcoming } = input;
  const highlights: string[] = [];
  const top = summary.byCategory[0];
  if (top) {
    highlights.push(
      `${money(summary.outflow, summary.currency)} out; the most went to ${top.category} (${money(top.amount, summary.currency)}, ${Math.round(top.share * 100)}%).`,
    );
  }
  for (const change of changes.slice(0, 2)) {
    highlights.push(
      change.change === null
        ? `New this period: ${change.category}, ${money(change.current, summary.currency)}.`
        : `You spent ${Math.abs(Math.round(change.change * 100))}% ${change.change > 0 ? 'more' : 'less'} on ${change.category} than the period before (${money(change.current, summary.currency)} vs ${money(change.previous, summary.currency)}).`,
    );
  }
  for (const duplicate of duplicates.slice(0, 2)) {
    highlights.push(
      `Possible double payment: ${duplicate.counterparty}, ${money(duplicate.amount, duplicate.currency)} ${duplicate.transactionIds.length} times between ${day(duplicate.firstAt)} and ${day(duplicate.lastAt)}.`,
    );
  }
  if (forecast.lowestBalance < 0) {
    highlights.push(
      `At this pace your balance runs out around ${day(forecast.lowestAt)}. Top up or move a bill.`,
    );
  } else if (forecast.startBalance > 0 && forecast.lowestBalance < forecast.startBalance * 0.2) {
    highlights.push(
      `Your balance drops to about ${money(forecast.lowestBalance, forecast.currency)} around ${day(forecast.lowestAt)}.`,
    );
  }
  const start = Date.parse(forecast.points[0]?.date ?? new Date().toISOString());
  const soon = upcoming.filter((bill) => {
    const due = Date.parse(bill.dueAt) - start;
    return due >= 0 && due < forecast.days * 86_400_000;
  });
  if (soon.length) {
    highlights.push(
      `${soon.length} ${soon.length === 1 ? 'bill' : 'bills'} due in the next ${forecast.days} days, ${money(forecast.upcomingTotal, forecast.currency)} in total.`,
    );
  }
  return highlights;
}

/** What the treasury card shows: balances, what's due, and the forecast in words. */
export function buildTreasury(input: {
  wallets: LedgerWallet[];
  upcoming: UpcomingBill[];
  forecast: CashFlowForecast;
}): TreasuryOverview {
  const { wallets, upcoming, forecast } = input;
  const notes = [
    `Projected balance in ${forecast.days} days: ${money(forecast.endBalance, forecast.currency)}.`,
  ];
  if (forecast.lowestBalance < 0) {
    notes.push(`You'd run short around ${day(forecast.lowestAt)} at this pace.`);
  }
  notes.push('Demo balances until WeWire is live.');
  return {
    totalUsd:
      Math.round(wallets.reduce((sum, wallet) => sum + wallet.usdEquivalent, 0) * 100) / 100,
    balances: wallets.map((wallet) => ({
      currency: wallet.currency,
      balance: wallet.balance,
      usdEquivalent: wallet.usdEquivalent,
    })),
    upcomingOutflows: [...upcoming]
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
      .slice(0, 8)
      .map((bill) => ({
        label: `${bill.label} · ${day(bill.dueAt)}`,
        amount: bill.amount,
        currency: bill.currency,
        kind: bill.kind,
      })),
    notes,
  };
}
