import {
  convertDemoAmount,
  type CashFlowForecast,
  type DuplicatePayment,
  type LedgerTransaction,
  type LedgerWallet,
  type UpcomingBill,
} from '@finora/shared';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Payments that look sent twice: same recipient, amount, and currency within
 * `windowHours`. Payroll runs are left out (paying the same salary is normal).
 */
export function findDuplicatePayments(
  transactions: LedgerTransaction[],
  windowHours = 48,
): DuplicatePayment[] {
  const sent = transactions
    .filter(
      (tx) => tx.direction === 'sent' && tx.status === 'completed' && tx.kind !== 'payroll_run',
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const groups = new Map<string, LedgerTransaction[]>();
  for (const tx of sent) {
    const key = `${tx.counterparty.trim().toLowerCase()}|${tx.currency}|${tx.amount}`;
    groups.set(key, [...(groups.get(key) ?? []), tx]);
  }
  const duplicates: DuplicatePayment[] = [];
  for (const group of groups.values()) {
    let run: LedgerTransaction[] = [];
    const flush = () => {
      if (run.length > 1) {
        duplicates.push({
          counterparty: run[0]!.counterparty,
          amount: run[0]!.amount,
          currency: run[0]!.currency,
          transactionIds: run.map((tx) => tx.id),
          firstAt: run[0]!.createdAt,
          lastAt: run.at(-1)!.createdAt,
        });
      }
    };
    for (const tx of group) {
      const last = run.at(-1);
      if (last && Date.parse(tx.createdAt) - Date.parse(last.createdAt) > windowHours * HOUR_MS) {
        flush();
        run = [];
      }
      run.push(tx);
    }
    flush();
  }
  return duplicates.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

/**
 * Projects the total balance over the next `days`: today's balance, plus the
 * average daily net of the last 30 days (excluding transfers between the
 * user's own wallets), minus each known bill on its due date.
 */
export function forecastCashFlow(input: {
  wallets: LedgerWallet[];
  transactions: LedgerTransaction[];
  upcoming: UpcomingBill[];
  now?: Date;
  days?: number;
  currency?: string;
}): CashFlowForecast {
  const now = input.now ?? new Date();
  const days = input.days ?? 30;
  const currency = input.currency ?? 'USD';
  const value = (amount: number, from: string) => convertDemoAmount(amount, from, currency);

  const startBalance = input.wallets.reduce(
    (sum, wallet) => sum + value(wallet.balance, wallet.currency),
    0,
  );
  const since = now.getTime() - 30 * DAY_MS;
  // Known bills are added on their own dates, so recurring and payroll runs are left out here.
  const history = input.transactions.filter(
    (tx) =>
      tx.status === 'completed' &&
      tx.direction !== 'swap' &&
      tx.kind !== 'payroll_run' &&
      !tx.category.startsWith('Bills') &&
      Date.parse(tx.createdAt) >= since,
  );
  const net30 = history.reduce(
    (sum, tx) => sum + (tx.direction === 'received' ? 1 : -1) * value(tx.amount, tx.currency),
    0,
  );
  const averageDailyNet = net30 / 30;

  const billsByDay = new Map<number, number>();
  let upcomingTotal = 0;
  for (const bill of input.upcoming) {
    const day = Math.floor((Date.parse(bill.dueAt) - now.getTime()) / DAY_MS);
    if (day < 0 || day >= days) continue;
    const amount = value(bill.amount, bill.currency);
    upcomingTotal += amount;
    billsByDay.set(day, (billsByDay.get(day) ?? 0) + amount);
  }

  let balance = startBalance;
  let lowestBalance = startBalance;
  let lowestAt = now;
  const points: CashFlowForecast['points'] = [{ date: now.toISOString(), balance: round(balance) }];
  for (let day = 0; day < days; day += 1) {
    balance += averageDailyNet - (billsByDay.get(day) ?? 0);
    const date = new Date(now.getTime() + (day + 1) * DAY_MS);
    if (balance < lowestBalance) {
      lowestBalance = balance;
      lowestAt = date;
    }
    if ((day + 1) % 7 === 0 || day === days - 1) {
      points.push({ date: date.toISOString(), balance: round(balance) });
    }
  }

  return {
    currency,
    days,
    startBalance: round(startBalance),
    endBalance: round(balance),
    lowestBalance: round(lowestBalance),
    lowestAt: lowestAt.toISOString(),
    averageDailyNet: round(averageDailyNet),
    upcomingTotal: round(upcomingTotal),
    points,
  };
}
